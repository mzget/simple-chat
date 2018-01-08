"use strict";
/**
 * Copyright 2016 Ahoo Studio.co.th.
 *
 * ChatRoomComponent for handle some business logic of chat room.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require("async");
const Rx = require("rxjs/Rx");
const BackendFactory_1 = require("stalk-js/starter/BackendFactory");
const stalk_js_1 = require("stalk-js");
const chatroomService = require("./services/ChatroomService");
const CryptoHelper_1 = require("./utils/CryptoHelper");
const index_1 = require("./index");
const models_1 = require("stalk-js/starter/models");
const getConfig = () => BackendFactory_1.BackendFactory.getInstance().config;
// const getStore = () => ChitChatFactory.getInstance().store;
exports.ON_MESSAGE_CHANGE = "ON_MESSAGE_CHANGE";
class ChatRoomComponent {
    constructor(dataManager) {
        this.updateMessageQueue = new Array();
        this.saveMessages = (chatMessages, message) => {
            let self = this;
            chatMessages.push(message);
            self.dataManager.messageDAL.saveData(self.roomId, chatMessages)
                .then((chats) => {
                if (!!self.chatroomDelegate) {
                    self.chatroomDelegate(stalk_js_1.ChatEvents.ON_CHAT, message);
                    self.chatroomDelegate(exports.ON_MESSAGE_CHANGE, chatMessages);
                }
            });
        };
        console.log("ChatRoomComponent: constructor");
        this.secure = index_1.SecureServiceFactory.getService();
        const backendFactory = BackendFactory_1.BackendFactory.getInstance();
        this.dataManager = dataManager;
        this.dataListener = backendFactory.dataListener;
        this.dataListener.addOnChatListener(this.onChat.bind(this));
        const source = Rx.Observable.timer(1000, 1000);
        const subscribe = source.subscribe((val) => {
            if (this.updateMessageQueue.length > 0) {
                const queues = this.updateMessageQueue.slice();
                this.updateMessageQueue = new Array();
                this.messageReadTick(queues, this.roomId);
            }
        });
    }
    static getInstance() {
        return ChatRoomComponent.instance;
    }
    static createInstance(datamanager) {
        if (!ChatRoomComponent.instance) {
            ChatRoomComponent.instance = new ChatRoomComponent(datamanager);
        }
        return ChatRoomComponent.instance;
    }
    getRoomId() {
        return this.roomId;
    }
    setRoomId(rid) {
        this.roomId = rid;
    }
    saveToPersisted(message) {
        let self = this;
        this.dataManager.messageDAL.getData(this.roomId)
            .then((chats) => {
            let chatMessages = (!!chats && Array.isArray(chats)) ? chats : new Array();
            if (message.type === models_1.MessageType[models_1.MessageType.Text]) {
                CryptoHelper_1.decryptionText(message)
                    .then((decoded) => {
                    self.saveMessages(chatMessages, message);
                })
                    .catch((err) => self.saveMessages(chatMessages, message));
            }
            else {
                self.saveMessages(chatMessages, message);
            }
        }).catch((err) => {
            console.warn("Cannot get persistend message of room", err);
        });
    }
    onChat(message) {
        console.log("ChatRoomComponent.onChat", message);
        if (this.roomId === message.rid) {
            this.saveToPersisted(message);
        }
        else {
            console.log("this msg come from other room.");
            if (!!this.outsideRoomDelegete) {
                this.outsideRoomDelegete(stalk_js_1.ChatEvents.ON_CHAT, message);
            }
        }
    }
    onRoomJoin(data) { }
    onLeaveRoom(data) { }
    messageReadTick(messageQueue, room_id) {
        return __awaiter(this, void 0, void 0, function* () {
            let chatMessages = Object.create(null);
            const chats = yield this.dataManager.messageDAL.getData(room_id);
            chatMessages = (!!chats && Array.isArray(chats)) ? chats : new Array();
            messageQueue.forEach((message) => {
                chatMessages.some((value) => {
                    if (value._id === message._id) {
                        value.readers = message.readers;
                        return true;
                    }
                });
            });
            const results = yield this.dataManager.messageDAL.saveData(room_id, chatMessages);
            if (!!this.chatroomDelegate) {
                this.chatroomDelegate(exports.ON_MESSAGE_CHANGE, results);
            }
        });
    }
    onMessageRead(message) {
        this.updateMessageQueue.push(message);
    }
    onGetMessagesReaders(dataEvent) {
        console.log("onGetMessagesReaders", dataEvent);
        const self = this;
        const myMessagesArr = JSON.parse(JSON.stringify(dataEvent.data));
        self.chatMessages.forEach((originalMsg, id, arr) => {
            if (self.dataManager.isMySelf(originalMsg.sender)) {
                myMessagesArr.some((myMsg, index, array) => {
                    if (originalMsg._id === myMsg._id) {
                        originalMsg.readers = myMsg.readers;
                        return true;
                    }
                });
            }
        });
        self.dataManager.messageDAL.saveData(self.roomId, self.chatMessages);
    }
    getPersistentMessage(rid) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            const messages = yield self.dataManager.messageDAL.getData(rid);
            if (messages && messages.length > 0) {
                const prom = new Promise((resolve, reject) => {
                    const chats = messages.slice(0);
                    async.forEach(chats, function iterator(chat, result) {
                        if (chat.type === models_1.MessageType[models_1.MessageType.Text]) {
                            if (getConfig().appConfig.encryption === true) {
                                self.secure.decryption(chat.body).then(function (res) {
                                    chat.body = res;
                                    result(null);
                                }).catch((err) => result(null));
                            }
                            else {
                                result(null);
                            }
                        }
                        else {
                            result(null);
                        }
                    }, (err) => {
                        console.log("decoded chats completed.", chats.length);
                        self.dataManager.messageDAL.saveData(rid, chats);
                        resolve(chats);
                    });
                });
                const chats = yield prom;
                return chats;
            }
            else {
                console.log("chatMessages is empty!");
                return new Array();
            }
        });
    }
    getNewerMessageRecord(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            let lastMessageTime = new Date();
            const getLastMessageTime = (cb) => {
                const { roomAccess } = getStore().getState().chatlogReducer;
                async.some(roomAccess, (item, cb) => {
                    if (item.roomId === self.roomId) {
                        lastMessageTime = item.accessTime;
                        cb(null, true);
                    }
                    else {
                        cb(null, false);
                    }
                }, (err, result) => {
                    cb(result);
                });
            };
            const saveMergedMessage = (histories) => __awaiter(this, void 0, void 0, function* () {
                let _results = new Array();
                if (messages && messages.length > 0) {
                    _results = messages.concat(histories);
                }
                else {
                    _results = histories.slice();
                }
                // Save persistent chats log here.
                const results = yield self.dataManager.messageDAL.saveData(self.roomId, _results);
                callback(_results, this.roomId);
            });
            const getNewerMessage = () => __awaiter(this, void 0, void 0, function* () {
                try {
                    const histories = yield self.getNewerMessages(lastMessageTime);
                    saveMergedMessage(histories);
                }
                catch (ex) {
                    saveMergedMessage([]);
                }
            });
            const messages = yield self.dataManager.messageDAL.getData(this.roomId);
            if (messages && messages.length > 0) {
                if (messages[messages.length - 1] !== null) {
                    lastMessageTime = messages[messages.length - 1].createTime;
                    getNewerMessage();
                }
                else {
                    getLastMessageTime((boo) => {
                        getNewerMessage();
                    });
                }
            }
            else {
                getLastMessageTime((boo) => {
                    getNewerMessage();
                });
            }
        });
    }
    getNewerMessages(lastMessageTime) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            try {
                const response = yield chatroomService.getNewerMessages(self.roomId, lastMessageTime);
                const value = yield response.json();
                console.log("getNewerMessages result", value);
                return new Promise((resolve, reject) => {
                    if (value.success) {
                        let histories = new Array();
                        histories = value.result;
                        if (histories.length > 0) {
                            async.forEach(histories, function (chat, cb) {
                                if (chat.type === models_1.MessageType[models_1.MessageType.Text]) {
                                    if (getConfig().appConfig.encryption === true) {
                                        self.secure.decryption(chat.body).then(function (res) {
                                            chat.body = res;
                                            cb(null);
                                        }).catch((err) => {
                                            cb(null);
                                        });
                                    }
                                    else {
                                        cb(null);
                                    }
                                }
                                else {
                                    cb(null);
                                }
                            }, function done(err) {
                                if (!!err) {
                                    console.error("get newer message error", err);
                                    reject(err);
                                }
                                else {
                                    resolve(histories);
                                }
                            });
                        }
                        else {
                            console.log("Have no newer message.");
                            resolve(histories);
                        }
                    }
                    else {
                        console.warn("WTF god only know.", value.message);
                        reject(value.message);
                    }
                });
            }
            catch (err) {
                throw new Error(err.message);
            }
        });
    }
    getOlderMessageChunk(room_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            function waitForRoomMessages() {
                return __awaiter(this, void 0, void 0, function* () {
                    const messages = yield self.dataManager.messageDAL.getData(room_id);
                    return messages;
                });
            }
            function saveRoomMessages(merged) {
                return __awaiter(this, void 0, void 0, function* () {
                    const value = yield self.dataManager.messageDAL.saveData(room_id, merged);
                    return value;
                });
            }
            const time = yield self.getTopEdgeMessageTime();
            if (time) {
                const response = yield chatroomService.getOlderMessagesCount(room_id, time.toString(), true);
                const result = yield response.json();
                console.log("getOlderMessageChunk value", result);
                // todo
                /**
                 * Merge messages record to chatMessages array.
                 * Never save message to persistend layer.
                 */
                if (result.success && result.result.length > 0) {
                    const earlyMessages = result.result;
                    const persistMessages = yield waitForRoomMessages();
                    if (!!persistMessages && persistMessages.length > 0) {
                        let mergedMessageArray = new Array();
                        mergedMessageArray = earlyMessages.concat(persistMessages);
                        const resultsArray = new Array();
                        const results = yield new Promise((resolve, rejected) => {
                            async.map(mergedMessageArray, function iterator(item, cb) {
                                const hasMessage = resultsArray.some((value, id) => {
                                    if (!!value && value._id === item._id) {
                                        return true;
                                    }
                                });
                                if (hasMessage === false) {
                                    resultsArray.push(item);
                                    cb(null, null);
                                }
                                else {
                                    cb(null, null);
                                }
                            }, function done(err, results) {
                                const merged = resultsArray.sort(self.compareMessage);
                                resolve(merged);
                            });
                        });
                        return yield saveRoomMessages(results);
                    }
                    else {
                        const merged = earlyMessages.sort(self.compareMessage);
                        return yield saveRoomMessages(merged);
                    }
                }
                else {
                    return new Array();
                }
            }
            else {
                throw new Error("getTopEdgeMessageTime fail");
            }
        });
    }
    getTopEdgeMessageTime() {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            function waitRoomMessage() {
                return __awaiter(this, void 0, void 0, function* () {
                    let topEdgeMessageTime = new Date();
                    const messages = yield self.dataManager.messageDAL.getData(self.roomId);
                    if (!!messages && messages.length > 0) {
                        if (!!messages[0].createTime) {
                            topEdgeMessageTime = messages[0].createTime;
                        }
                    }
                    console.log("topEdgeMessageTime is: ", topEdgeMessageTime);
                    return topEdgeMessageTime;
                });
            }
            return new Promise((resolve, reject) => {
                waitRoomMessage().then((topEdgeMessageTime) => {
                    resolve(topEdgeMessageTime);
                }).catch((err) => {
                    reject(err);
                });
            });
        });
    }
    compareMessage(a, b) {
        if (a.createTime > b.createTime) {
            return 1;
        }
        if (a.createTime < b.createTime) {
            return -1;
        }
        // a must be equal to b
        return 0;
    }
    updateReadMessages() {
        const self = this;
        const backendFactory = BackendFactory_1.BackendFactory.getInstance();
        async.map(self.chatMessages, function itorator(message, resultCb) {
            if (!backendFactory.dataManager.isMySelf(message.sender)) {
                const chatroomApi = backendFactory.getServer().getChatRoomAPI();
                chatroomApi.updateMessageReader(message._id, message.rid);
            }
            resultCb(null, null);
        }, function done(err) {
            // done.
        });
    }
    updateWhoReadMyMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            const res = yield self.getTopEdgeMessageTime();
            const backendFactory = BackendFactory_1.BackendFactory.getInstance();
            const chatroomApi = backendFactory.getServer().getChatRoomAPI();
            chatroomApi.getMessagesReaders(res.toString());
        });
    }
    getMemberProfile(member, callback) {
        const server = BackendFactory_1.BackendFactory.getInstance().getServer();
        if (server) {
            server.getMemberProfile(member._id, callback);
        }
    }
    getMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            const messages = yield this.dataManager.messageDAL.getData(this.roomId);
            return messages;
        });
    }
    dispose() {
        console.log("ChatRoomComponent: dispose");
        this.dataListener.removeOnChatListener(this.onChat.bind(this));
        delete ChatRoomComponent.instance;
    }
}
exports.ChatRoomComponent = ChatRoomComponent;
