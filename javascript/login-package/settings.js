
/**
 * Utilities for changing a user's password.
 * This is intended to be used in a minimal form, usually in an iframe.
 */
var Settings = {

    init: function() {
        $("#password1").on(
                Keys.textChangeEvents,
                Keys.wrapTextChangeHandler(Settings.onPasswordInput_, Settings));
        $("#password2").on(
                Keys.textChangeEvents,
                Keys.wrapTextChangeHandler(Settings.onPasswordInput_, Settings));
        $("#password2").on(
                "keypress",
                function(e) {
                    if (e.keyCode === $.ui.keyCode.ENTER) {
                        Settings.submitForm_();
                    }
                });

        $("#submit-settings").click(_.bind(Settings.onClickSubmit_, Settings));
    },

    onPasswordInput_: function(e) {
        if (e.target.id === "password1" || e.target.id === "password2") {
            this.validateNewPassword();
        }
    },

    onClickSubmit_: function(e) {
        this.submitForm_();
    },

    submitForm_: function() {
        $("#submit-settings")
            .val("Submitting...")
            .prop("disabled", true);

        // We can't use $.ajax to send - we have to actually do a form POST
        // since the requirement of sending over https means we'd
        // break same-origin policies of browser XHR's
        $("#pw-change-form")
            .find("#continue")
                .val(window.location.href)
                .end()
            .submit();
    },

    // Must be consistent with what's on the server in auth/passwords.py
    MIN_PASSWORD_LENGTH: 8,

    validateNewPassword: _.debounce(function() {
        var password1 = $("#password1").val();
        var password2 = $("#password2").val();

        // Check basic length.
        if (password1 && password1.length < Settings.MIN_PASSWORD_LENGTH) {
            $(".sidenote.password1")
                    .addClass("error")
                    .text("Password too short");
        } else {
            $(".sidenote.password1").removeClass("error").text("");
        }

        // Check matching.
        if (password2 && password2 !== password1) {
            $(".sidenote.password2").addClass("error").text("Passwords don't match.");
        } else {
            $(".sidenote.password2").removeClass("error").text("");
        }
    }, 500)
};