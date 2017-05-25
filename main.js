initMain();

function initMain() {
    var $loaderContainer = $("<div>").css({
        'position': 'fixed',
        'bottom': '5px',
        'right': '5px',
        'z-index': '999999999'
    });

    var $loaderSpinner = $('<div>').addClass('loader');

    $loaderContainer.append($loaderSpinner);

    browser.runtime.onMessage.addListener(requestHandler);

    function requestHandler(request) {
        return new Promise(function (resolve, reject) {
            var response = {};

            if (request.cmd == "getSelectedHtml") {
                var selectedHtml = getHTMLOfSelection();
                response = {
                    html: selectedHtml,
                    href: location.href
                };
                resolve(response);
            } else if (request.cmd == "appendLoader") {
                appendLoader();
                resolve({});
            } else if (request.cmd == "remoteInProcessNotification") {
                showRemoteInProcessNotification();
                resolve({});
            } else if (request.cmd == "successNotification") {
                showSuccessNotification(request.text, request.type, function (obj) {
                    resolve(obj);
                });
            } else if (request.cmd == "errorNotification") {
                showErrorNotification();
                resolve({});
            } else if (request.cmd == "showModal") {
                showModal(request.type);
                resolve({});
            }
        });
    }

    function getHTMLOfSelection() {
        var range;
        if (document.selection && document.selection.createRange) {
            range = document.selection.createRange();
            return range.htmlText;
        } else if (window.getSelection) {
            var selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                range = selection.getRangeAt(0);
                var clonedSelection = range.cloneContents();
                var div = document.createElement('div');
                div.appendChild(clonedSelection);
                return div.innerHTML;
            } else {
                return '';
            }
        } else {
            return '';
        }
    }

    function appendLoader() {
        $loaderContainer.appendTo('body');
    }

    function removeLoader() {
        $loaderContainer.remove();
    }

    function showRemoteInProcessNotification() {
        removeLoader();
        notie.alert({
            type: 1,
            text: 'Your remote upload has begun.',
            time: 4
        });
    }

    function showSuccessNotification(text, type, callback) {
        removeLoader();
        copyTextToClipboard(text);

        var confirmText = "";
        if (type == 0)
            confirmText = 'Download links copied to clipboard. Open them in new tab?';
        else if (type == 1)
            confirmText = 'Transfer has started & links are copied. Open them in new tab?'

        notie.confirm({
            text: confirmText,
            submitText: 'Yes',
            cancelText: 'No',
            submitCallback: function () {
                callback({success: true});
            }
        });
    }

    function showErrorNotification() {
        removeLoader();
        notie.alert({
            type: 'error',
            text: 'An error occured!',
            time: 4
        });
    }

    function showModal(type) {
        var label = "";

        if (type == 0)
            label = 'Instant download custom links';
        else if (type == 1)
            label = 'Cloud download custom links';
        else if (type == 2)
            label = 'Remote download custom links';

        notie.textarea({
            text: label,
            submitText: 'Process link(s) to Offcloud.com',
            cancelText: 'Cancel',
            rows: 5,
            submitCallback: function (customLinks) {
                if (customLinks && customLinks.trim() != "") {
                    chrome.runtime.sendMessage({
                        cmd: "custom",
                        html: customLinks,
                        type: type
                    });
                }
            }
        });
    }

    function copyTextToClipboard(text) {
        var copyFrom = $('<textarea/>');
        copyFrom.text(text.replace("\n", "\r\n"));
        $('body').append(copyFrom);
        copyFrom.select();
        document.execCommand('copy');
        copyFrom.remove();
    }
}