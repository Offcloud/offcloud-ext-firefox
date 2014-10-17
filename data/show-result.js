/**
 * Created by Hank on 9/5/2014.
 * Modified by Teracy on 10/17/2014
 */

var s = self.options.storage,
    sm = self.postMessage,
    errorList = {
        premium: "User must purchase a premium downloading addon for this download",
        links: "User must purchase a Link increase addon for this download",
        proxy: "User must purchase a proxy downloading addon for this download",
        video: "User must purchase a video sharing site support addon for this download",
        unknown: "Unknown error, please try one more time or contact us."
    };

function createHtml(tag, data) {
    data = data || {};
    return $("<" + tag + ">", data);
}


function showBsModel(msg, list, showType, customType) {
    var modalBody = $("#momane_modal"),
        modalMsgBody = $("#momane_modalBody"),
        modalCopyBtn = $("#momane_copy"),
        modalOpenBtn = $("#momane_open"),
        closeBtn = $('#momane_modal_close'),
        modalTitle = $("#myModalLabel"),
        modalFooter = $("#momane_modal_footer");
    closeBtn.click(function () {
        modalBody.fadeOut();
        modalBody.remove();
        sm({cmd: "removeFrame"});
    });
    if (showType != "custom") {
        if (!msg.remote && !msg.not_available && !msg.error) {
            var urlArea = modalMsgBody.find("textarea");
            urlArea.click(function () {
                urlArea.select();
            });
            if (!list) {
                urlArea.val(msg.url);

            } else {
                urlArea.val(msg.join("\n"));
            }
            modalTitle.text("Your Offcloud.com links");
            modalCopyBtn.click(function () {
                sm({
                    cmd: 'copy',
                    content: urlArea.val()
                }, function (resp) {
                    modalCopyBtn.fadeOut();
                    modalCopyBtn.fadeIn();
                });
            });

            modalOpenBtn.click(function () {
                if (!list) {
                    window.open(msg.url);
                } else {
                    var urlLists = urlArea.val();
                    if (urlLists) {
                        urlLists = urlLists.split("\n");
                        for (var i = 0; i < urlLists.length; i++) {
                            window.open(urlLists[i]);
                        }
                    }
                }

            });

        } else if (msg.error) {
            modalTitle.text("Error Occurred");
            var errorText = createHtml('h5', {class: 'error', text: msg.error}),
                errorBtn = createHtml('button', {
                                class: 'btn btn-primary',
                                id: 'momane_error',
                                text: 'Check your Offcloud.com account',
                                click: function() {
                                    window.open("https://offcloud.com/");
                                }
                            });
            modalMsgBody.html(errorText);
            modalFooter.html(errorBtn);
        } else {
            modalTitle.text("Your Offcloud.com results");
            var finalInfo = "",
                msgText = createHtml('h5', {text: 'Your query to Offcloud.com API has returned the following:'}),
                msgSecondText = '',
                errorBtn = '';
            modalMsgBody.html(msgText);
            if (!msg.remote) {
                if (msg.not_available) {
                    finalInfo = errorList[msg.not_available];
                } else {
                    finalInfo = errorList.unknown;
                }
                errorBtn = createHtml('button', {
                                class: 'btn btn-primary',
                                id: 'momane_error',
                                text: 'Check your Offcloud.com account',
                                click: function() {
                                    window.open("https://offcloud.com/");
                                }
                            });
                modalFooter.html(errorBtn);
            }
            else if (msg.remote) {
                finalInfo = msg.remote;
                errorBtn = createHtml('button', {
                                class: 'btn btn-primary',
                                id: 'momane_remote',
                                text: 'Check your Offcloud.com account',
                                click: function() {
                                    window.open(" https://offcloud.com/#/remote");
                                }
                            });
                modalFooter.html(errorBtn);
            }
            msgSecondText = createHtml('h6', {text: finalInfo || 'undefined'});
            modalMsgBody.append(msgSecondText);

        }
    } else {

        var cusModalTitle = ["Instant download custom links", "Cloud download custom links" , "Remote download custom links"];
        modalTitle.text(cusModalTitle[customType]);
        var processBtn = createHtml('button', {
                                class: 'btn btn-primary',
                                id: 'momane_cus',
                                text: 'Process link(s) to Offcloud.com',
                                click: function() {
                                    var customLinks = modalBody.find("textarea").val();
                                    if (customLinks && customLinks.trim() != "") {
                                        sm({cmd: "custom", html: customLinks, remote: customType});
                                    } else {
                                        var helpBlock = createHtml('p', {
                                            class: 'help-block',
                                            text: 'Please input links you want to process.'
                                        });
                                        modalBody.addClass('has-error');
                                        modalBody.find("textarea").after(helpBlock)
                                        modalBody.find("textarea").focus();
                                    }
                                }
                            });
        modalFooter.html(processBtn);

    }
    modalBody.fadeIn();
}
showBsModel(s.result || {}, s.isList, s.showType, s.customType);