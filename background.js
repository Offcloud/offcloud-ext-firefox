var remoteOptionId;
var apiKey;

var APIURLS = {
    instantDld: 'https://offcloud.com/api/instant/download',
    cloudDld: 'https://offcloud.com/api/cloud/download',
    remoteDld: 'https://offcloud.com/api/remote/download',
    login: 'https://offcloud.com/login',
    checkLogin: 'https://offcloud.com/api/login/check',
    getRemoteId: 'https://offcloud.com/api/remote-account/list',
    remoteSet: 'https://www.offcloud.com/#/remote'
};

restoreOptions();

initMenus();

function restoreOptions() {
    chrome.storage.local.get(['apiKey', 'remoteOptionId'], function (object) {
        if (object.apiKey != null)
            apiKey = object.apiKey;

        if (object.remoteOptionId != null)
            remoteOptionId = object.remoteOptionId;
    });
}

function getApiKey(callback) {
    chrome.storage.local.get('apiKey', function (result) {
        apiKey = result.apiKey;
        if (apiKey == null) {
            $.post('https://offcloud.com/api/account/get', function (data) {
                if (data.error) {
                    notifyNotLoggedIn();
                } else {
                    apiKey = data.apiKey;
                    chrome.storage.local.set({
                        apiKey: apiKey
                    }, function () {
                        setDefaultRemoteAccount(function () {
                            callback();
                        });
                    });
                }
            });
        } else {
            callback();
        }
    });
}

function setApiKey(newApiKey) {
    chrome.storage.local.set({
        apiKey: newApiKey
    }, function () {
        apiKey = newApiKey;
        setDefaultRemoteAccount(()=> {
        });
    });
}

function initMenus() {
    chrome.contextMenus.removeAll();

    chrome.contextMenus.create({
        type: "normal",
        title: "Instant download selected links",
        contexts: ["link", "selection"],
        onclick: function (clickData, tab) {
            downloadAction(clickData, tab, APIURLS.instantDld, false, 0);
        }
    });
    chrome.contextMenus.create({
        type: "normal",
        title: "Cloud download selected links",
        contexts: ["link", "selection"],
        onclick: function (clickData, tab) {
            downloadAction(clickData, tab, APIURLS.cloudDld, false, 1);
        }
    });
    chrome.contextMenus.create({
        type: "normal",
        title: "Remote download selected links",
        contexts: ["link", "selection"],
        onclick: function (clickData, tab) {
            downloadAction(clickData, tab, APIURLS.remoteDld, true, 2);
        }
    });

    chrome.contextMenus.create({
        type: "separator",
        contexts: ["link", "selection"]
    });

    chrome.contextMenus.create({
        type: "normal",
        title: "Instant download custom links",
        contexts: ["all"],
        onclick: function (clickData, tab) {
            customDownload(tab, 0);
        }
    });
    chrome.contextMenus.create({
        type: "normal",
        title: "Cloud download custom links",
        contexts: ["all"],
        onclick: function (clickData, tab) {
            customDownload(tab, 1);
        }
    });
    chrome.contextMenus.create({
        type: "normal",
        title: "Remote download custom links",
        contexts: ["all"],
        onclick: function (clickData, tab) {
            customDownload(tab, 2);
        }
    });
}

function customDownload(tab, type) {
    if (apiKey == null) {
        checkLogin(function () {
            getApiKey(function () {
                browser.tabs.sendMessage(tab.id, {
                    cmd: "showModal",
                    type: type
                });
            });
        });
    } else {
        browser.tabs.sendMessage(tab.id, {
            cmd: "showModal",
            type: type
        });
    }
}

function downloadAction(clickData, tab, apiLink, remote, type) {
    if (apiKey == null) {
        checkLogin(function () {
            getApiKey(function () {
                startAction();
            });
        });
    } else {
        startAction();
    }

    function startAction() {
        apiLink += "?apiKey=" + apiKey;

        browser.tabs.sendMessage(tab.id, {
            cmd: "appendLoader"
        });

        if (clickData.linkUrl) {
            processCall(apiLink, clickData.linkUrl, remote, tab, type);
        } else if (clickData.selectionText) {
            browser.tabs.sendMessage(tab.id, {
                cmd: "getSelectedHtml"
            }).then(function (resp) {
                if (resp && resp.html) {
                    processMultipleLink(resp.html, true, remote, tab, apiLink, resp.href, type);
                }
            }).catch(function onError(error) {
            });
        }
    }
}

function processMultipleLink(html, needReg, remote, tab, api, href, type) {
    var result = [];
    if (needReg) {
        result = findLinkByRegex(html);
    } else {
        result = findLinkByText(html);
    }

    result = result.map(function (link) {
        if (link.startsWith('http')) {
            return link;
        } else {
            return href + link;
        }
    });

    if (result && result.length > 1) {
        var requestList = [];
        for (var i = 0; i < result.length; i++) {
            var dataBody = {
                url: result[i]
            };
            if (remote) {
                dataBody.remoteOptionId = remoteOptionId;
            }
            requestList.push($.ajax(api, {
                method: 'POST',
                data: dataBody
            }));
        }
        var multiRequest = $.when.apply($, requestList);
        multiRequest.done(function (data) {
            var finalData = [];
            $.each(arguments, function (index, responseData) {
                if (responseData[1] == "success") {
                    if (responseData[0].not_available) {
                        browser.tabs.sendMessage(tab.id, {
                            cmd: "errorNotification"
                        });

                        return false;
                    } else {
                        if (remote) {
                            browser.tabs.sendMessage(tab.id, {
                                cmd: "remoteInProcessNotification"
                            });
                            return false;
                        } else {
                            if (!responseData[0].error)
                                finalData.push(responseData[0].url);
                        }
                    }
                } else {
                    browser.tabs.sendMessage(tab.id, {
                        cmd: "errorNotification"
                    });
                }
            });

            if (finalData.length != 0) {
                //copying the result to the clipboard
                var text = finalData.join("\n");

                browser.tabs.sendMessage(tab.id, {
                    cmd: "successNotification",
                    text: text,
                    type: type
                }, function (res) {
                    if (res) {
                        finalData.forEach(function (url) {
                            browser.tabs.create({
                                url: url
                            });
                        });
                    }
                });
            }
        });
    } else if (result && result.length == 1) {
        processCall(api, result[0], remote, tab, type);
    }
}

function processCall(api, link, remote, tab, type) {
    var dataBody = {
        url: link
    };
    if (remote) {
        dataBody.remoteOptionId = remoteOptionId;
        processAjax(api, link, true, tab, dataBody, type);

    } else {
        processAjax(api, link, false, tab, dataBody, type);
    }
}

function findLinkByRegex(html) {
    var linkReg = /href=[\'"]?([^\'" >]+)/g;
    var result = html.match(linkReg);
    if (result) {
        for (var i = 0; i < result.length; i++) {
            result[i] = result[i].replace('href="', '');
        }
    }
    return result;
}

function findLinkByText(text) {
    var urlReg = /[a-zA-z]+:\/\/[^\s]*/g;
    return text.match(urlReg);
}

function processAjax(api, link, remote, tab, dataBody, type) {
    $.ajax(api, {
        method: 'POST',
        data: dataBody
        //        'contentType': 'multipart/form-data'
    }).done(function (data) {
        if (!data.not_available && remote) {
            browser.tabs.sendMessage(tab.id, {
                cmd: "remoteInProcessNotification"
            });
        } else if (!data.not_available) {
            var url = data.url;
            if (url != null) {
                browser.tabs.sendMessage(tab.id, {
                    cmd: "successNotification",
                    text: url,
                    type: type
                }, function (res) {
                    if (res) {
                        browser.tabs.create({
                            url: url
                        });
                    }
                });
            } else {
                browser.tabs.sendMessage(tab.id, {
                    cmd: "errorNotification"
                });
            }
        } else {
            browser.tabs.sendMessage(tab.id, {
                cmd: "errorNotification"
            });
        }
    }).fail(function () {
        browser.tabs.sendMessage(tab.id, {
            cmd: "errorNotification"
        });
    });
}

function checkLogin(callback) {
    $.get(APIURLS.checkLogin, function (response) {
        var loggedIn = response.loggedIn;

        if (loggedIn)
            callback();
        else
            notifyNotLoggedIn();

    }).fail(function () {
        showErrorMessage();
    });
}

function setDefaultRemoteAccount(callback) {
    $.get(APIURLS.getRemoteId + "?apikey=" + apiKey, function (data) {
        if (!data.error) {
            var remoteOptionsArray = data.data;
            if (remoteOptionsArray.length > 0)
                remoteOptionId = remoteOptionsArray[0].remoteOptionId;
            callback();
        }
    });
}

chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
    var cmd = req.cmd;

    if (req.action == "setApiKey")
        setApiKey(req.newApiKey);

    if (req.action == "setRemoteOptionId")
        remoteOptionId = req.newRemoteOptionId;

    if (req.action == "removeRemoteOptionId")
        remoteOptionId = null;

    if (cmd == "checkPageUrl") {
        if (sender.url == sender.tab.url) {
            sendResponse({
                success: true
            });
        } else {
            sendResponse({
                success: false
            });
        }
    }

    if (cmd == "custom") {
        var currentApi;
        if (req.type == 0) {
            currentApi = APIURLS.instantDld;
        } else if (req.type == 1) {
            currentApi = APIURLS.cloudDld;
        } else {
            currentApi = APIURLS.remoteDld;
        }
        currentApi += "?apiKey=" + apiKey;

        browser.tabs.sendMessage(sender.tab.id, {
            cmd: "appendLoader"
        });
        processMultipleLink(req.html, false, req.type == 2, sender.tab, currentApi, null, req.type);
    }
});

function showErrorMessage() {
    showNotification("errorMsg", {
        type: "basic",
        title: ' Offcloud.com is offline',
        message: 'Sorry, Offcloud.com is offline, please try again later'
    });
}

function notifyNotLoggedIn() {
    showNotification("notlogin", {
            type: "basic",
            title: 'You are currently not logged in',
            message: 'You are currently not logged into Offcloud. Please log into your account...'
        },
        true,
        APIURLS.login);
}

function showNotification(name, options, redirect, redirectUrl) {
    chrome.notifications.clear(name, function () {
        chrome.notifications.create(name, {
            type: options.type,
            iconUrl: 'icon64.png',
            title: options.title,
            message: options.message
        }, function () {
            if (redirect) {
                browser.tabs.create({
                    active: true,
                    url: redirectUrl
                });
            }
        });
    });
}