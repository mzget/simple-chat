import { queue } from "async";
import InternalStore from "../InternalStore";
var config = InternalStore.config;
export function manageUploadQueue(files, target_api, onFinished, speedCallBack, onSpeedCallBack) {
    if (speedCallBack === void 0) { speedCallBack = false; }
    var results = [];
    var q = queue(function (task, callback) {
        console.log("queue worker");
        uploadFile(task, target_api).then(function (url) {
            results.push(url);
            if (speedCallBack) {
                onSpeedCallBack({ url: url, id: task.uniqueId });
            }
            callback();
        }).catch(function (err) {
            callback(err);
        });
    }, 1);
    // assign a callback
    q.drain = function () {
        onFinished(results);
    };
    // add some items to the queue (batch-wise)
    q.push(files, function (err) {
        console.log("finished processing item", err);
    });
    // add some items to the front of the queue
    // q.unshift({ name: 'bar' }, function (err) {
    //     console.log('finished processing bar');
    // });
}
function uploadFile(file, target_api) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", target_api);
        xhr.onload = function () {
            if (xhr.status !== 200) {
                console.log("Upload failed. " + "Expected HTTP 200 OK response, got " + xhr.responseText);
                reject(xhr.status);
                return;
            }
            if (!xhr.responseText) {
                alert("Upload failed. " + "No response payload.");
                reject(xhr.status);
                return;
            }
            var response = JSON.parse(xhr.response);
            var filename = response.filename;
            var url = config.BOL_REST.host + filename;
            resolve(url);
        };
        function onTimeout() {
            console.warn("Timeout", xhr.responseText);
            reject(xhr.responseText);
        }
        function onError() {
            console.warn("Error", xhr.responseText);
            reject(xhr.responseText);
        }
        xhr.ontimeout = onTimeout;
        xhr.onerror = onError;
        if (xhr.upload) {
            xhr.upload.onprogress = function (event) {
                if (event.lengthComputable) {
                    console.log("upload onprogress", event.loaded + "/" + event.total);
                }
            };
        }
        var formdata = new FormData();
        formdata.append("image", {
            uri: file.image,
            name: file.image.slice((Math.max(0, file.image.lastIndexOf("/")) || Infinity) + 1),
            type: "image/jpg",
        });
        formdata.append("extension", "JPG");
        xhr.setRequestHeader("Content-Type", "image/JPG");
        xhr.setRequestHeader("x-api-key", config.BOL_REST.apiKey);
        xhr.send(formdata);
    });
}
export function uploadImageChat(formdata) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", config.api.fileUpload);
        function onTimeout() {
            console.warn("Timeout");
            console.log(xhr.responseText);
            reject(xhr.responseText);
        }
        function onError() {
            console.warn("General network error");
            console.log(xhr.responseText);
            reject(xhr.responseText);
        }
        function onloaded() {
            if (xhr.status !== 200) {
                console.dir(xhr);
                reject(xhr.status);
                return;
            }
            if (!xhr.responseText) {
                reject(xhr.status);
                return;
            }
            var response = JSON.parse(xhr.response);
            var filename = response.filename;
            var path = config.BOL_REST.host.substring(0, config.BOL_REST.host.length - 1);
            var profilePicUrl = path + filename;
            console.log("result image url: ", profilePicUrl);
            resolve(profilePicUrl);
        }
        xhr.onload = onloaded;
        xhr.ontimeout = onTimeout;
        xhr.onerror = onError;
        if (xhr.upload) {
            xhr.upload.onprogress = function (event) {
                console.log("upload onprogress", event);
            };
        }
        // xhr.setRequestHeader('Content-Type', 'multipart/form-data');
        /* enctype is multipart/form-data */
        // var sBoundary = "---------------------------" + Date.now().toString(16);
        // oAjaxReq.setRequestHeader("Content-Type", "multipart\/form-data; boundary=" + sBoundary);
        xhr.send(formdata);
    });
}
