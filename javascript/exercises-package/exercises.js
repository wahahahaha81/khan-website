/**
 * Views and logic for exercise/stack/card interactions
 *
 * Catalog of events triggered on Exercises:
 *
 *   * problemTemplateRendered -- when a problem template that is ready for
 *   khan-exercises targetting is rendered
 *
 *   * readyForNextProblem -- when a card is ready for the next problem to
 *   be rendered by khan-exercises
 *
 *   * upcomingExercise -- when a new exercise is approaching in the upcoming
 *   queue, this is triggered to give listeners a chance to preload any
 *   requirements
 *
 *   * newUserExerciseData -- when an updated userExercise has been received
 *   and cached in Exercises.BottomlessQueue
 *
 *   * warning -- when a warning about issues like disabled sessionStorage
 *   has been fired
 *
 */
var Exercises = {

    // practice mode uses a single exercise, not an entire topic
    practiceMode: false,
    reviewMode: false,

    // topic will be populated if we're not in review or practice
    // (single-exercise) mode
    topic: null,

    userData: null,

    // exercise will be populated if we're in practice mode
    exercise: null,

    // readOnlyUserExercise will only be populated if we're in readOnly mode
    readOnlyUserExercise: null,

    currentCard: null,
    currentCardView: null,

    completeStack: null,
    completeStackView: null,

    incompleteStack: null,
    incompleteStackView: null,

    sessionStats: null,

    // Keeps track of # of pending API requests
    pendingAPIRequests: 0,

    /**
     * Called to initialize the exercise page. Passed in with JSON information
     * rendered from the server.
     */
    init: function(json) {

        this.topic = new Topic(json.topic);
        this.exercise = new Exercise(json.exercise);

        this.userData = json.userData;
        this.practiceMode = json.practiceMode;
        this.reviewMode = json.reviewMode;
        this.readOnly = json.readOnly;

        // sessionStats and completeStack will be loaded from local cache if available
        this.sessionStats = new Exercises.SessionStats(/* attrs */ null, {sessionId: this.sessionId()});
        this.completeStack = new Exercises.CachedStackCollection(/* models */ null, {sessionId: this.sessionId()});

        // If we loaded a partially complete stack from cache, reduce
        // the size of the incomplete stack accordingly.
        this.incompleteStack = new Exercises.StackCollection(json.incompleteStack);
        this.incompleteStack.shrinkBy(this.completeStack.length);

        // Start w/ the first card ready to go
        this.currentCard = this.incompleteStack.pop();

        if (!this.readOnly) {

            // Prepare our never-ending queue of upcoming user exercises
            Exercises.BottomlessQueue.init(
                    this.topic, 
                    json.userExercises, 
                    /* refillEnabled */ !this.reviewMode && !this.practiceMode
            );

        } else {

            // readOnly only shows a single historical problem from a single
            // user exercise.
            this.readOnlyUserExercise = json.userExercises[0];

        }

    },

    /**
     * Returns an identifier for the current user's session that can be
     * used for various cache keys. This sessionId isn't meant to be globally
     * unique, just an identifier for the current user and topic/exercise
     * being tackled.
     */
    sessionId: function() {

        if (this.readOnly) {
            // Read only mode stores and uses no cached session state
            return null;
        }

        var contextId = null;

        if (this.reviewMode) {
            contextId = "review";
        } else if (this.practiceMode && !!this.exercise) {
            contextId = "practice:" + this.exercise.get("name");
        } else if (!!this.topic) {
            contextId = "topic:" + this.topic.get("id");
        }

        if (!contextId) {
            throw "Missing exercise or topic for current session";
        }

        return [
            this.userData.keyEmail,
            contextId
        ].join(":")
    },

    render: function() {

        Handlebars.registerPartial("exercise-header", Templates.get("exercises.exercise-header"));
        Handlebars.registerPartial("card", Templates.get("exercises.card"));
        Handlebars.registerPartial("card-leaves", Templates.get("exercises.card-leaves"));

        var profileExercise = Templates.get("exercises.exercise");

        $(".exercises-content-container").html(profileExercise({
            topic: this.topic.toJSON(),
            exercise: this.exercise.toJSON(),
            practiceMode: this.practiceMode,
            reviewMode: this.reviewMode
        }));

        this.incompleteStackView = new Exercises.StackView({
            collection: this.incompleteStack,
            el: $(".incomplete-stack"),
            frontVisible: false
        }); 

        this.completeStackView = new Exercises.StackView({
            collection: this.completeStack,
            el: $(".complete-stack"),
            frontVisible: true
        }); 

        this.currentCardView = new Exercises.CurrentCardView({
            model: this.currentCard,
            el: $(".current-card") }
        );

        this.currentCardView.render();
        this.incompleteStackView.render();
        this.completeStackView.render();

        this.bindEvents();

    },

    bindEvents: function() {

        // Triggered when Next Question has been clicked.
        //
        // Flip to the next card every time a new problem is generated by
        // khan-exercises
        //
        // TODO: eventually this event trigger should be owned by this object
        // instead of khan-exercises so we have better control of when to
        // render the results of khan-exercises or, alternatively, other
        // content inside of each card.
        $(Khan).bind("gotoNextProblem", function() {

            // Hide any badges that were just awarded.
            Badges.hide();

            // Start the next card process
            Exercises.nextCard();

            // Return false so we take control of when nextProblem is triggered
            return false;

        });

        // Triggered when a problem is done (correct answer received,
        // regardless of hints/attempts) but before Next Question
        // has been clicked
        $(Khan).bind("problemDone", function() {

            Exercises.currentCard.set({
                done: true, 
                leavesEarned: Exercises.currentCard.get("leavesAvailable")
            });

        });

        // Triggered when a user attempts an answer
        $(Khan).bind("checkAnswer", function(ev, data) {

            if (data.pass === true) {

                if (data.fast === true) {
                    // Speed completion earns 4 leaves right now
                    Exercises.currentCard.decreaseLeavesAvailable(4);
                } else {
                    // Ordinary problem completion earns 3
                    Exercises.currentCard.decreaseLeavesAvailable(3);
                }

            } else if (data.pass === false) {
                // Incorrect answer drops leaves possibility to 2
                Exercises.currentCard.decreaseLeavesAvailable(2);
            }

        });

        $(Khan).bind("hintUsed", function() {
            // Using a hint drops leaves possibility to 2.
            Exercises.currentCard.decreaseLeavesAvailable(2);
        });

        $(Khan).bind("allHintsUsed", function() {
            // Using all hints drops leaves possibility to 1.
            Exercises.currentCard.decreaseLeavesAvailable(1);
        });

        $(Khan)
            .bind("apiRequestStarted", function() { Exercises.pendingAPIRequests++; })
            .bind("apiRequestEnded", function() { Exercises.pendingAPIRequests--; });

    },

    nextUserExercise: function() {

        if (this.readOnly) {
            return this.readOnlyUserExercise;
        } else {
            return this.BottomlessQueue.next();
        }
    },

    nextCard: function() {

        // animationOptions.deferreds stores all pending animations
        // that each subsequent step can wait on via $.when if needed
        var animationOptions = { deferreds: [] };

        if (this.currentCard) {

            // Move current to front of complete stack
            this.completeStack.add(this.currentCard, _.extend(animationOptions, {at: 0}));

            // Empty current card
            this.currentCard = null;

            animationOptions.deferreds.push(this.currentCardView.animateToRight());

        }

        // Wait for push-to-right animations to finish
        $.when.apply(null, animationOptions.deferreds).done(function() {

            // Detach events from old view
            Exercises.currentCardView.detachEvents();

            // Pop from left
            Exercises.currentCard = Exercises.incompleteStack.pop(animationOptions);

            // If this is the last card in the stack, clear
            // our right-hand-stack cache
            if (!Exercises.incompleteStack.length) {
                Exercises.completeStack.clearCache();
                Exercises.sessionStats.clearCache();
            }

            // Render next card
            Exercises.currentCardView = new Exercises.CurrentCardView({
                model: Exercises.currentCard,
                el: $(".current-card") }
            );
            Exercises.currentCardView.render();

            // Finish animating from left
            $.when(Exercises.currentCardView.moveLeft()).done(function() {

                setTimeout(function() {
                    Exercises.currentCardView.animateFromLeft();
                }, 1);

            });

        });

    }

};
