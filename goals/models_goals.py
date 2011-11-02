#!/usr/bin/python
# -*- coding: utf-8 -*-

import models
import templatefilters
import logging
from object_property import ObjectProperty

from google.appengine.ext import db
from google.appengine.ext.db import Key

class Goal(db.Model):
    title = db.StringProperty()
    created_on = db.DateTimeProperty(auto_now_add=True)
    updated_on = db.DateTimeProperty(auto_now=True)
    objectives = ObjectProperty()
    active = False

    @staticmethod
    def create(user_data, goal_data, title, objective_descriptors):
        parent_list = GoalList.get_from_data(goal_data, GoalList)
        if not parent_list:
            # Create a parent object for all the goals & objectives
            key = Key.from_path('GoalList', 1, parent=user_data.key())
            goal_list = GoalList.get_or_insert(str(key), user=user_data.user)

            # Update UserData
            user_data.goal_list = goal_list
            user_data.put()
        else:
            goal_list = parent_list[0]

        # Create the new goal
        new_goal = Goal(goal_list)
        new_goal.title = title

        objectives = []
        for descriptor in objective_descriptors:
            if descriptor['type'] == 'GoalObjectiveExerciseProficiency':
                objectives.append(GoalObjectiveExerciseProficiency(descriptor['exercise'], user_data))
            if descriptor['type'] == 'GoalObjectiveWatchVideo':
                objectives.append(GoalObjectiveWatchVideo(descriptor['video'], user_data))
            if descriptor['type'] == "GoalObjectiveAnyExerciseProficiency":
                objectives.append(GoalObjectiveAnyExerciseProficiency(description="Any exercise"))
            if descriptor['type'] == "GoalObjectiveAnyVideo":
                objectives.append(GoalObjectiveAnyVideo(description="Any video"))

        new_goal.objectives = objectives
        logging.critical(new_goal.objectives)
        new_goal.put()

        # Set the goal active
        goal_list.active = new_goal
        goal_list.put()

        return new_goal

    def get_visible_data(self, user_exercise_graph):
        goal_ret = {}
        goal_ret['id'] = self.key().id()
        goal_ret['title'] = self.title
        goal_ret['objectives'] = []
        goal_ret['active'] = self.active
        goal_ret['created'] = self.created_on
        goal_ret['created_ago'] = templatefilters.timesince_ago(self.created_on)
        goal_ret['updated'] = self.updated_on
        goal_ret['updated_ago'] = templatefilters.timesince_ago(self.updated_on)
        for objective in self.objectives:
            objective_ret = {}
            objective_ret['type'] = objective.__class__.__name__
            objective_ret['description'] = objective.description
            objective_ret['progress'] = objective.progress
            objective_ret['url'] = objective.url()
            objective_ret['status'] = objective.get_status(user_exercise_graph)
            goal_ret['objectives'].append(objective_ret)
        return goal_ret

class GoalList(db.Model):
    user = db.UserProperty()
    active = db.ReferenceProperty(Goal)

    @staticmethod
    def get_from_data(data, type):
        return [entity for entity in data if isinstance(entity, type)]

    @staticmethod
    def get_visible_for_user(user_data, user_exercise_graph=None):
        if user_data:
            # Fetch data from datastore
            goal_data = user_data.get_goal_data()
            if len(goal_data) == 0:
                return []

            goals = GoalList.get_from_data(goal_data, Goal)
            goal_list = GoalList.get_from_data(goal_data, GoalList)[0]

            # annotate the active goal, this is icky
            for goal in goals:
                if goal.key() == GoalList.active.get_value_for_datastore(goal_list):
                    goal.active = True

            return [goal.get_visible_data(user_exercise_graph) for goal in goals]

        return []

    @staticmethod
    def delete_goal(user_data, id):
        # Fetch data from datastore
        goal_data = user_data.get_goal_data()
        goals = GoalList.get_from_data(goal_data, Goal)

        for goal in goals:
            if str(goal.key().id()) == str(id):
                goal.delete()
                return True

        return False

    @staticmethod
    def delete_all_goals(user_data):
        # Fetch data from datastore
        goal_data = user_data.get_goal_data()
        goals = GoalList.get_from_data(goal_data, Goal)

        for goal in goals:
            goal.delete()

    @staticmethod
    def activate_goal(user_data, id):
        # Fetch data from datastore
        goal_data = user_data.get_goal_data()
        goal_list = GoalList.get_from_data(goal_data, GoalList)[0]
        goals = GoalList.get_from_data(goal_data, Goal)

        id = int(id)
        for goal in goals:
            if goal.key().id() == id:
                goal_list.active = goal
                goal_list.put()
                return True

        return False

class GoalObjective(object):
    # Objective status
    progress = 0.0
    description = None

    def __init__(self, description):
        self.description = description

    def url():
        '''url to which the objective points when used as a nav bar.'''
        raise Exception

    def record_progress(self):
        return False

    def record_complete(self):
        self.progress = 1.0

    @property
    def is_completed(self):
        return self.progress >= 1.0

    def get_status(self, user_exercise_graph):
        if self.is_completed:
            return "proficient"

        if self.progress > 0:
            return "started"

        return ""

class GoalObjectiveExerciseProficiency(GoalObjective):
    # Objective definition (Chosen at goal creation time)
    exercise_name = None

    def __init__(self, exercise, user_data):
        self = GoalObjectiveExerciseProficiency()
        self.exercise_name = exercise.name
        self.description = exercise.display_name
        self.progress = user_data.get_or_insert_exercise(exercise).progress

    def url(self):
        exercise = models.Exercise.get_by_name(self.exercise_name)
        return exercise.relative_url

    def record_progress(self, user_data, goal_data, user_exercise):
        if self.exercise_name == user_exercise.exercise:
            if user_data.is_proficient_at(user_exercise.exercise):
                self.progress = 1.0
            else:
                self.progress = user_exercise.progress
            return True

        return False

    def get_status(self, user_exercise_graph):
        if not user_exercise_graph:
            return ""

        exercise_name = self.exercise_name
        graph_dict = user_exercise_graph.graph_dict(exercise_name)
        student_review_exercise_names = user_exercise_graph.review_exercise_names()
        status = ""

        if graph_dict["proficient"]:

            if exercise_name in student_review_exercise_names:
                status = "review"
            else:
                status = "proficient"
#                if not graph_dict["explicitly_proficient"]:
 #                   status = "Proficient (due to proficiency in a more advanced module)"

        elif graph_dict["struggling"]:
            status = "struggling"
        elif graph_dict["total_done"] > 0:
            status = "started"
        return status

class GoalObjectiveAnyExerciseProficiency(GoalObjective):
    # which exercise fulfilled this objective, set upon completion
    exercise_name = None

    def url(self):
        if self.exercise_name:
            return models.Exercise.get_relative_url(self.exercise_name)
        else:
            return "/exercisedashboard"

    def record_complete(self, exercise):
        super(GoalObjectiveAnyExerciseProficiency, self).record_complete()
        self.exercise_name = exercise.name
        self.description = exercise.display_name
        return True

class GoalObjectiveWatchVideo(GoalObjective):
    # Objective definition (Chosen at goal creation time)
    video_key = None
    video_readable_id = None

    def __init__(self, video, user_data):
        self = GoalObjectiveWatchVideo()
        self.video_key = str(video.key())
        self.video_readable_id = video.readable_id
        self.description = video.title

        user_video = models.UserVideo.get_for_video_and_user_data(video, user_data)
        if user_video:
            self.progress = user_video.progress
        else:
            self.progress = 0.0

    def url(self):
        return models.Video.get_ka_url(self.video_readable_id)

    def record_progress(self, user_data, goal_data, user_video):
        obj_key = db.Key(self.video_key)
        video_key = models.UserVideo.video.get_value_for_datastore(user_video)
        if obj_key == video_key:
            self.progress = user_video.progress
            return True
        return False

class GoalObjectiveAnyVideo(GoalObjective):
    # which video fulfilled this objective, set upon completion
    video_key = None
    video_readable_id = None

    def url(self):
        if self.video_readable_id:
            return models.Video.get_ka_url(self.video_readable_id)
        else:
            return "/"

    def record_complete(self, video):
        super(GoalObjectiveAnyVideo, self).record_complete()
        self.video_key = str(video.key())
        self.video_readable_id = video.readable_id
        self.description = video.title
        return True
