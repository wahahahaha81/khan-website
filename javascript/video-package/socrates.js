Socrates = {};

// this should work with a QuestionView
Socrates.ControlPanel = Backbone.View.extend({
	el: ".interactive-video-controls",

	controls: [],

	events: {
		'click button#label': 'addLabel',
		'click button#inputtext': 'addInputText'
	},

	addLabel: function() {
		this.addView(new Socrates.Label());
	},

	addInputText: function() {
		this.addView(new Socrates.InputText());
	},

	addView: function(view) {
		this.controls.push(view);

		// place in document before rendering, as jquery.ui checks if element is
		// positioned, and positioning is done in external CSS.
		this.$controlEl.append(view.el);
		view.render();
	},

	serializeHtml: function() {
		_.each(this.controls, function(c) {
			c.moveable(false);
		});
		return this.$controlEl.html();
	}
}, {
	onReady: function() {
		window.ControlPanel = new Socrates.ControlPanel();
	}
});

// Editing actions needed:
// 1. Lock / unlock moving (console)
// 2. Delete (console)
// 3. Edit text (dblclick)

Socrates.Label = Backbone.View.extend({
	tagName: "div",
	className: "label",

	events: {
		'dblclick': 'promptForContents'
	},

	render: function() {
		$(this.el).text('Default label contents');
		this.moveable(true);
		return this;
	},

	isMoveable: false,
	moveable: function(val) {
		if (val === this.isMoveable) return this;
		if (val == null) {
			val = !this.isMoveable;
		}
		this.isMoveable = val;

		if (this.isMoveable) {
			$(this.el)
				.addClass('moveable')
				.resizable()
				.draggable();
		} else {
			$(this.el)
				.removeClass('moveable')
				.resizable('destroy')
				.draggable('destroy');
		}

		return this;
	},

	promptForContents: function(evt) {
		var contents = prompt("Enter label contents", $(this.el).text());
		$(this.el).text(contents);
		if (this.isMoveable) {
			// need to toggle as .text() destroys the corner thing
			this.moveable(false);
			this.moveable(true);
		}
	},

	serializedForm: function() {

	}
});

Socrates.InputText = Backbone.View.extend({
	className: "inputtext",
	template: Templates.get("video.inputtext"),

	events: {
		'dblclick': 'promptForContents'
	},

	render: function() {
		var contents = this.template({
			placeholder: '?'
		});
		$(this.el).html(contents);
		this.moveable(true);
		return this;
	},

	isMoveable: false,
	moveable: function(val) {
		if (val === this.isMoveable) return this;
		if (val == null) {
			val = !this.isMoveable;
		}
		this.isMoveable = val;

		if (this.isMoveable) {
			$(this.el)
				.addClass('moveable')
				.resizable()
				.draggable();
		} else {
			$(this.el)
				.removeClass('moveable')
				.resizable('destroy')
				.draggable('destroy');
		}

		return this;
	},

	promptForContents: function(evt) {
		var $input = this.$('input');
		var contents = prompt("Enter placeholder contents",
			$input.attr('placeholder'));
		$input.attr('placeholder', contents);
	},

	serializedForm: function() {
		this.$('input').prop("disabled", false);
	}
});

$(Socrates.ControlPanel.onReady);

Socrates.Bookmark = Backbone.Model.extend({
	seconds: function() {
		return Socrates.Question.timeToSeconds(this.get("time"));
	},

	slug: function() {
		return _.str.slugify(this.get('title'));
	},

	toJSON: function() {
		var json = Backbone.Model.prototype.toJSON.call(this);
		json.slug = this.slug();
		return json;
	}
}, {
	timeToSeconds: function(time) {
		if (time == null || time.length === 0) {
			throw "Invalid argument";
		}
		// convert a string like "4m21s" into just the number of seconds
		result = 0;
		var i = 0;
		while(time[i]) {
			var start = i;
			while(time[i] && /[\d\.,]/.test(time[i])) i++;
			var n = parseFloat(time.slice(start, i));
			var unit = time[i] || "s"; // assume seconds if reached end
			if (unit == "m") {
				result += n * 60;
			} else if (unit == "s") {
				result += n;
			} else {
				throw "Unimplemented unit, only ISO8601 durations with mins and secs";
			}
			i++;
		}
		return result;
	}
});

Socrates.Question = Socrates.Bookmark.extend({
	key: function() {
		return this.get('youtubeId') + "-" + this.get('time');
	},

	htmlFile: Socrates.Bookmark.prototype.slug,

	slug: function() {
		return this.htmlFile() + "/q" + this.get('id');
	}
});

Socrates.QuestionCollection = Backbone.Collection.extend({
	model: Socrates.Question
});

Socrates.QuestionView = Backbone.View.extend({
	className: "question",

	events: {
		'click .submit-area a.submit': 'submit',
		'click .submit-area a.skip': 'skip'
	},

	timeDisplayed: 0,
	startTime: null,

	initialize: function() {
		_.extend(this, this.options);
		this.version = 1;
		this.loaded = false;
		this.render();
	},

	render: function() {
		// preload html
		$.get(this.htmlUrl()).success(_.bind(function(html) {
			$(this.el).html(html);
			this.loaded = true;
		}, this));

		return this;
	},

	hide: function() {
		this.finishRecordingTime();
		$(this.el).hide();
		return this;
	},

	finishRecordingTime: function () {
		if (this.startTime) {
			this.timeDisplayed += (+new Date() - this.startTime);
			this.startTime = null;
		} else {
			this.timeDisplayed = 0;
		}
		return this.timeDisplayed;
	},

	show: function() {
		this.startTime = +new Date();
		$(this.el).show();
		return this;
	},

	htmlUrl: function() {
		return "/socrates/questions/" + this.model.htmlFile() + ".html";
	},

	imageUrl: function() {
		return "/socrates/questions/" + this.model.key() + ".jpeg";
	},

	isCorrect: function(data) {
		var correctAnswer = this.model.get('correctData');

		// if no answer is specified, any answer is correct
		if (correctAnswer == null) {
			return true;
		}

		// otherwise make sure they got it right.
		// todo: look at how khan-exercise does their fancy number handling
		return _.isEqual(data, correctAnswer);
	},

	getData: function() {
		// possible ideal impl: ask editing controls for info?

		// for now: do it myself.
		data = {};

		// process all matrix-inputs
		var matrixInputs = this.$("table.matrix-input");
		_.each(matrixInputs, function(table) {
			var matrix = _.map($(table).find("tr"), function(tr) {
				return _.map($(tr).find("input"), function(input) {
					return parseFloat($(input).val());
				});
			});

			var name = $(table).attr("name") || "answer";
			data[name] = matrix;
		});

		// process all checkbox-grids
		var checkboxGrids = this.$("table.checkbox-grid");
		_.each(checkboxGrids, function(grid) {
			var headers = _.map($(grid).find("thead th"), function(td) {
				return $(td).attr("name");
			});
			headers = _.rest(headers, 1);
			var answer = {};
			_.each($(grid).find("tbody tr"), function(tr) {
				var row = {};
				_.each($(tr).find("input"), function(input, i) {
					row[headers[i]] = $(input).prop("checked");
				});
				answer[$(tr).attr("name")] = row;
			});

			var name = $(grid).attr("name") || "answer";
			data[name] = answer;
		});

		// process the result of the inputs
		var inputs = this.$("input").
			not(matrixInputs.find("input")).
			not(checkboxGrids.find("input"));

		_.each(inputs, function(el) {
			var $el = $(el);
			var key = $el.attr("name");

			var val;
			if (_.include(["checkbox", "radio"], $el.attr("type"))) {
				val = $el.prop("checked");
			} else {
				val = $el.val();
			}

			var isArray = false;
			if (data[key]) {
				if (!_.isArray(data[key])) {
					data[key] = [data[key]];
				}
				isArray = true;
			}

			if (isArray) {
				data[key].push(val);
			} else {
				data[key] = val;
			}
		});
		return data;
	},

	getResponse: function() {
		// get response data
		var data = this.getData();

		// find how long it took to answer, then reset the countera
		var timeDisplayed = this.finishRecordingTime();
		this.timeDisplayed = 0;

		return {
			time: this.model.get('time'),
			youtubeId: this.model.get('youtubeId'),
			id: this.model.get('id'),
			version: this.version,
			correct: this.isCorrect(data),
			data: data,
			timeDisplayed: timeDisplayed
		};
	},

	validateResponse: function(response) {
		requiredProps = ['id', 'version', 'correct', 'data', 'youtubeId',
			'time'];
		var hasAllProps = _.all(requiredProps, function(prop) {
			return response[prop] != null;
		});
		if (!hasAllProps) {
			console.log(response);
			throw "Invalid response from question";
		}
		return true;
	},

	submit: function() {
		var response = this.getResponse();
		this.validateResponse(response);
		this.log('submit', response);

		if (response.correct) {
			console.log("correct");
			this.trigger("submitted");
			// todo: resume video, skipping explanation (seek)
		} else {
			console.log("incorrect!");
			// todo: rewind back to explanation
			// todo: rewind back to introduction
		}
	},

	skip: function() {
		var response = this.getResponse();
		this.validateResponse(response);
		this.log('skip', response);
		this.trigger('skipped');
	},

	log: function(kind, response) {
		console.log("POSTing response", kind, response);
	}
});

Socrates.MasterView = Backbone.View.extend({
	initialize: function(options) {
		this.views = options.views;
	},

	render: function() {
		$(this.el).append(_.pluck(this.views, 'el'));
	}
});

Socrates.Nav = Backbone.View.extend({
	template: Templates.get("video.socrates-nav"),

	render: function() {
		// want to render list of toplevel items only
		var sections = [];
		this.model.each(function(item) {
			var json = {
				title: item.get('title'),
				time: item.get('time'),
				slug: item.slug(),
				nested: []
			};

			if (item.get('nested')) {
				_.last(sections).nested.push(json);
			} else {
				sections.push(json);
			}
		});

		$(this.el).html(this.template({
			sections: sections
		}));
		return this;
	}
});

var recursiveTrigger = function recursiveTrigger(triggerFn) {
	var t = window.VideoStats.getSecondsWatched();

	triggerFn(t);

	// schedule another call when the duration is probably ticking over to
	// the next tenth of a second
	t = window.VideoStats.getSecondsWatched();
	_.delay(recursiveTrigger, (Poppler.nextPeriod(t, 0.1) - t)*1000, triggerFn);
};

Socrates.QuestionRouter = Backbone.Router.extend({
	routes: {
		":segment": "reactToNewFragment",
		":segment/:qid": "reactToNewFragment"
	},

	beep: new Audio("/socrates/starcraft_chat_sound.mp3"),

	initialize: function(options) {
		this.videoControls = options.videoControls;

		// listen to player state changes
		$(this.videoControls).on("playerStateChange",
			_.bind(this.playerStateChange, this));

		this.bookmarks = options.bookmarks;

		this.questions = this.bookmarks.filter(function(b) {
			return b.constructor.prototype === Socrates.Question.prototype;
		});

		// wrap each question in a view
		this.questionViews = this.questions.map(function(question) {
			return new Socrates.QuestionView({model: question});
		});

		// subscribe to submit and skip
		_.each(this.questionViews, function(view) {
			view.bind("skipped", this.skipped, this);
			view.bind("submitted", this.submitted, this);
		}, this);

		// hookup question display to video timelime
		this.poppler = new Poppler();
		_.each(this.questions, function(q) {
			this.poppler.add(q.seconds(), _.bind(this.videoTriggeredQuestion, this, q));
		}, this);

		// trigger poppler every tenth of a second
		recursiveTrigger(_.bind(this.poppler.trigger, this.poppler));
	},

	playerStateChange: function(evt, state) {
		if (state === 1) { // playing
			if (this.ignoreNextPlay) {
				this.ignoreNextPlay = false;
				return;
			}
			var t = VideoStats.getSecondsWatched();
			// console.log("seek due to statechange");
			this.poppler.seek(t);
		} else if (state === 3) { // buffering
			// buffering is always followed by a play event. We only care about
			// play events caused by the user scrubbing, so ignore it
			this.ignoreNextPlay = true;
		}
	},

	// recieved a question or view, find the corresponding view
	questionToView: function(view) {
		if (view.constructor.prototype == Socrates.Question.prototype) {
			view = _.find(this.questionViews, function(v) { return v.model == view; });
		}
		return view;
	},

	reactToNewFragment: function(segment, qid) {
		if (qid) {
			segment = segment + "/" + qid;
		}

		// blank fragment for current state of video
		if (segment === "") {
			this.leaveCurrentState();
		}

		// top level question
		// slug for navigating to a particular question
		var question = this.bookmarks.find(function(b) {
			return b.slug() === segment;
		});
		if (question) {
			if (question.constructor.prototype === Socrates.Question.prototype) {
				this.linkTriggeredQuestion(question);
				return;
			} else {
				// was a bookmark
				var seconds = question.seconds();
				this.fragmentTriggeredSeek(seconds);
				return;
			}
		}

		// seek to time, e.g. 4m32s
		try {
			var seconds = Socrates.Question.timeToSeconds(slug);
			this.fragmentTriggeredSeek(seconds);
			return;
		} catch(e) {
			// ignore
		}

		// invalid fragment, replace it with nothing

		// todo(dmnd) replace playing with something that makes more sense
		this.navigate("playing", {replace: true, trigger: true});
	},

	// called when video was playing and caused a question to trigger
	videoTriggeredQuestion: function(question) {
		// pause the video
		this.videoControls.pause();
		this.beep.play();

		// update the fragment in the URL
		this.navigate(question.slug());

		this.enterState(question);
		return true; // block poppler
	},

	// called when question has been triggered manually via clicking a link
	linkTriggeredQuestion: function(question) {
		this.videoControls.onPlayerReady(_.bind(function() {
			// notify poppler
			this.poppler.blocked = true;
			this.poppler.seek(question.seconds());
			this.poppler.eventIndex++; // make poppler only listen to events after the current one

			// put video in correct position
			this.videoControls.pause();
			if (this.videoControls.player.getPlayerState() === 2) {
				// only seek to the correct spot if we are actually paused
				this.videoControls.player.seekTo(question.seconds(), true);
			}

			this.enterState(question);
		}, this));
	},

	fragmentTriggeredSeek: function(seconds) {
		this.leaveCurrentState();
		this.videoControls.onPlayerReady(_.bind(function() {
			this.poppler.blocked = true;
			this.poppler.seek(seconds);
			this.videoControls.player.seekTo(seconds, true);
			this.poppler.blocked = false;
		}, this));
	},

	enterState: function(view) {
		this.leaveCurrentState();

		var nextView = this.questionToView(view);
		if (nextView) {
			this.currentView = nextView;
			this.currentView.show();
		} else {
			console.log("no view, wtf");
		}

		return this;
	},

	leaveCurrentState: function() {
		if (this.currentView) {
			if (this.currentView.hide)
				this.currentView.hide();
			this.currentView = null;
		}
		return this;
	},

	skipped: function() {
		var seconds = this.currentView.model.seconds();
		this.currentView.hide();

		this.navigate("playing");
		this.poppler.resumeEvents();

		if (this.poppler.blocked) {
			// another blocking event was present. Do nothing.
		} else {
			// no more events left, play video

			// prevent seek() from being called
			this.ignoreNextPlay = true;

			if (this.videoControls.player.getPlayerState() == 2) {
				this.videoControls.play();
			}
			else {
				this.videoControls.player.seekTo(seconds);
			}
		}
	},

	submitted: function() {
		this.skipped();
	}
});

Socrates.Skippable = (function() {
	var Skippable = function(options) {
		_.extend(this, options);
	};

	Skippable.prototype.seconds = function() {
		return _.map(this.span, Socrates.Question.timeToSeconds);
	};

	Skippable.prototype.trigger = function() {
		var pos = this.seconds()[1];
		this.videoControls.player.seekTo(pos, true);
	};

	return Skippable;
})();

$(function() {
	var data = [
		new Socrates.Bookmark({
			time: "0m0s",
			title: "What is a matrix?"
		}),
		new Socrates.Bookmark({
			time: "0m59s",
			title: "Dimensions of a matrix"
		}),
		new Socrates.Question({
			time: "2m5.7s",
			title: "Dimensions of a matrix",
			nested: true,
			youtubeId: "xyAuNHPsq-g",
			id: 1,
			correctData: { rows: "4", cols: "5" }
		}),
		new Socrates.Bookmark({
			time: "2m6s",
			title: "Referencing elements in a matrix"
		}),
		new Socrates.Question({
			time: "3m20s",
			title: "Referencing elements in a matrix",
			nested: true,
			youtubeId: "xyAuNHPsq-g",
			id: 2,
			correctData: { answer: "2" }
		}),
		new Socrates.Bookmark({
			time: "3m28s",
			title: "What are matrices used for?"
		}),
		new Socrates.Question({
			time: "4m23.9s",
			title: "What are matrices used for?",
			nested: true,
			youtubeId: "xyAuNHPsq-g",
			id: 3,
			correctData: { answer: [true, true, true, true, true, true] }
		}),
		new Socrates.Bookmark({
			time: "4m42s",
			title: "Defining matrix addition"
		}),
		new Socrates.Question({
			time: "6m31s",
			title: "Defining matrix addition",
			nested: true,
			youtubeId: "xyAuNHPsq-g",
			id: 4
		}),
		new Socrates.Bookmark({
			time: "6m31s",
			title: "Matrix addition"
		}),
		new Socrates.Bookmark({
			time: "7m39s",
			title: "Commutativity of matrix addition"
		}),
		new Socrates.Question({
			time: "8m9s",
			title: "Commutativity of matrix addition",
			nested: true,
			youtubeId: "xyAuNHPsq-g",
			id: 5
		}),
		new Socrates.Question({
			time: "8m10.5s",
			title: "Matrix addition",
			youtubeId: "xyAuNHPsq-g",
			id: 6,
			correctData: { answer: [[80, 23], [13, 25]] }
		}),
		new Socrates.Bookmark({
			time: "8m10s",
			title: "Matrix subtraction"
		}),
		new Socrates.Bookmark({
			time: "9m44s",
			title: "Matrices that can be added"
		}),
		new Socrates.Bookmark({
			time: "11m50s",
			title: "Matrix terminology"
		}),
		new Socrates.Question({
			time: "11m50s",
			title: "Matrix terminology",
			nested: true,
			youtubeId: "xyAuNHPsq-g",
			id: 7,
			correctData: {
				"scalar": {"scalar": true, "row-vector": false, "column-vector": false, "matrix": false},
				"column-vector": {"scalar": false, "row-vector": false, "column-vector": true, "matrix": true},
				"row-vector": {"scalar": false, "row-vector": true, "column-vector": false, "matrix": true},
				"matrix": {"scalar": false, "row-vector": false, "column-vector": false, "matrix": true}
			}
		})
	];

	window.Bookmarks = new Backbone.Collection(data);
	window.nav = new Socrates.Nav({
		el: ".socrates-nav",
		model: Bookmarks
	});
	nav.render();

	window.Router = new Socrates.QuestionRouter({
		bookmarks: window.Bookmarks,
		videoControls: window.VideoControls
	});

	window.masterView = new Socrates.MasterView({
		el: ".video-overlay",
		views: Router.questionViews
	});
	masterView.render();

	// window.skippable = [
	// 	{span: ["25.5s", "42s"]},
	// 	{span: ["1m40s", "2m2s"]}
	// ];
	// skippable = _.map(skippable, function(item) {
	// 	return new Socrates.Skippable(_.extend(item, {videoControls: window.VideoControls}));
	// });
	// _.each(skippable, function(item) {
	// 	poppler.add(item.seconds()[0], _.bind(item.trigger, item));
	// });

	Backbone.history.start({
		root: "video/introduction-to-matrices?topic=linear-algebra-1#elements-in-a-matrix"
	});
});
