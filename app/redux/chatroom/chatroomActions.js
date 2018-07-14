/**
 * Copyright 2016 Ahoo Studio.co.th.
 *
 * This is pure function action for redux app.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { HttpStatusCode, ChatEvents } from "stalk-js/stalkjs";
import { BackendFactory } from "stalk-js/starter";
import { SecureServiceFactory } from "../../utils/secure/SecureServiceFactory";
import { ChatRoomComponent, ON_MESSAGE_CHANGE } from "../../ChatRoomComponent";
import { MessageType } from "stalk-js/starter/models";
import { RoomType, } from "../../models";
import * as R from "ramda";
import { createAction } from "redux-actions";
import * as chatroomService from "../../services/ChatroomService";
import * as MessageService from "../../services/MessageService";
import * as NotificationManager from "../stalkBridge/stalkNotificationActions";
import { updateLastAccessRoom } from "../chatlogs/chatlogRxActions";
import { updateMessagesRead } from "./chatroomRxEpic";
import InternalStore from "../../InternalStore";
const getConfig = () => InternalStore.config;
const getStore = () => InternalStore.store;
const authReducer = () => InternalStore.authStore;
/**
 * ChatRoomActionsType
 */
export const REPLACE_MESSAGE = "REPLACE_MESSAGE";
export const ON_EARLY_MESSAGE_READY = "ON_EARLY_MESSAGE_READY";
export function initChatRoom(currentRoom) {
    if (!currentRoom) {
        throw new Error("Empty roomInfo");
    }
    const roomName = currentRoom.owner;
    if (!roomName && currentRoom.type === RoomType.privateChat) {
        if (Array.isArray(currentRoom.members)) {
            currentRoom.members.some((v) => {
                if (v._id !== InternalStore.authStore.user._id) {
                    currentRoom.owner.username = v.username;
                    return true;
                }
                return false;
            });
        }
    }
    const chatroomComp = ChatRoomComponent.createInstance(InternalStore.dataManager);
    chatroomComp.setRoomId(currentRoom._id);
    NotificationManager.unsubscribeGlobalNotifyMessageEvent();
    chatroomComp.chatroomDelegate = onChatRoomDelegate;
    chatroomComp.outsideRoomDelegete = onOutSideRoomDelegate;
}
function onChatRoomDelegate(event, data) {
    if (event === ChatEvents.ON_CHAT) {
        console.log("onChatRoomDelegate: ", ChatEvents.ON_CHAT, data);
        const messageImp = data;
        /**
         * Todo **
         * - if message_id is mine. Replace message_id to local messages list.
         * - if not my message. Update who read this message. And tell anyone.
         */
        if (InternalStore.authStore.user._id === messageImp.sender) {
            // dispatch(replaceMyMessage(newMsg));
            console.log("is my message");
        }
        else {
            console.log("is contact message");
            // @ Check app not run in background.
            const appState = InternalStore.appStateEvent;
            console.log("AppState: ", appState); // active, background, inactive
            if (!!appState) {
                if (appState === "active") {
                    MessageService.updateMessageReader(messageImp._id, messageImp.rid)
                        .then((response) => response.json()).then((value) => {
                        console.log("updateMessageReader: ", value);
                    }).catch((err) => {
                        console.warn("updateMessageReader: ", err);
                    });
                }
                else if (appState !== "active") {
                    // @ When user joined room but appState is inActive.
                    // sharedObjectService.getNotifyManager().notify(newMsg, appBackground, localNotifyService);
                    console.warn("Call local notification here...");
                }
            }
        }
    }
    else if (event === ON_MESSAGE_CHANGE) {
        getStore().dispatch(onMessageChangedAction(data));
    }
}
function onOutSideRoomDelegate(event, data) {
    console.log("Call notification here..."); // active, background, inactive
    if (event === ChatEvents.ON_CHAT) {
        NotificationManager.notify(data);
    }
}
export const ON_MESSAGE_CHANGED = "ON_MESSAGE_CHANGED";
const onMessageChangedAction = createAction(ON_MESSAGE_CHANGED, (messages) => messages);
const onEarlyMessageReady = (data) => ({ type: ON_EARLY_MESSAGE_READY, payload: data });
export function checkOlderMessages() {
    const room = getStore().getState().chatroomReducer.room;
    ChatRoomComponent.getInstance().getTopEdgeMessageTime().then((res) => {
        chatroomService.getOlderMessagesCount(room._id, res.toString(), false)
            .then((response) => response.json())
            .then((result) => {
            console.log("getOlderMessagesCount", result);
            if (result.success && result.result > 0) {
                // console.log("onOlderMessageReady is true ! Show load earlier message on top view.");
                getStore().dispatch(onEarlyMessageReady(true));
            }
            else {
                // console.log("onOlderMessageReady is false ! Don't show load earlier message on top view.");
                getStore().dispatch(onEarlyMessageReady(false));
            }
        }).catch((err) => {
            console.warn("getOlderMessagesCount fail", err);
            getStore().dispatch(onEarlyMessageReady(false));
        });
    });
}
export const LOAD_EARLY_MESSAGE_SUCCESS = "LOAD_EARLY_MESSAGE_SUCCESS";
const loadEarlyMessageSuccess = (payload) => ({ type: LOAD_EARLY_MESSAGE_SUCCESS, payload });
export function loadEarlyMessageChunk(roomId) {
    ChatRoomComponent.getInstance().getOlderMessageChunk(roomId).then((docs) => {
        getStore().dispatch(loadEarlyMessageSuccess(docs));
        // @check older message again.
        checkOlderMessages();
        // # update messages read.
        if (docs.length > 0) {
            getStore().dispatch(updateMessagesRead(docs, roomId));
        }
    }).catch((err) => {
        console.warn("loadEarlyMessageChunk fail", err);
    });
}
export const GET_NEWER_MESSAGE = "GET_NEWER_MESSAGE";
export const GET_NEWER_MESSAGE_FAILURE = "GET_NEWER_MESSAGE_FAILURE";
export const GET_NEWER_MESSAGE_SUCCESS = "GET_NEWER_MESSAGE_SUCCESS";
const getNewerMessage = createAction(GET_NEWER_MESSAGE);
const getNewerMessageFailure = createAction(GET_NEWER_MESSAGE_FAILURE);
const getNewerMessageSuccess = createAction(GET_NEWER_MESSAGE_SUCCESS, (messages) => messages);
export function getNewerMessageFromNet() {
    getStore().dispatch(getNewerMessage());
    ChatRoomComponent.getInstance().getNewerMessageRecord((results, roomId) => {
        getStore().dispatch(getNewerMessageSuccess(results));
        // # update messages read.
        if (results.length > 0) {
            // getStore().dispatch(updateMessagesRead(results as MessageImp[], roomId));
        }
    }).catch((err) => {
        if (err) {
            console.warn("getNewerMessageRecord fail", err);
        }
        getStore().dispatch(getNewerMessageFailure());
    });
}
export function getMessages() {
    return __awaiter(this, void 0, void 0, function* () {
        const chatroomComp = ChatRoomComponent.getInstance();
        const messages = yield chatroomComp.getMessages();
        return messages;
    });
}
const SEND_MESSAGE_REQUEST = "SEND_MESSAGE_REQUEST";
const SEND_MESSAGE_SUCCESS = "SEND_MESSAGE_SUCCESS";
export const SEND_MESSAGE_FAILURE = "SEND_MESSAGE_FAILURE";
const sendMessageRequest = () => ({ type: SEND_MESSAGE_REQUEST });
const sendMessageSuccess = () => ({ type: SEND_MESSAGE_SUCCESS });
const sendMessageFailure = (error) => ({ type: SEND_MESSAGE_FAILURE, payload: error });
export function sendMessage(message) {
    getStore().dispatch(sendMessageRequest());
    const backendFactory = BackendFactory.getInstance();
    const server = backendFactory.getServer();
    if (message.type === MessageType[MessageType.Text] && InternalStore.encryption === true) {
        const secure = SecureServiceFactory.getService();
        secure.encryption(message.body).then((result) => {
            message.body = result;
            if (!!server) {
                const msg = {};
                msg.data = message;
                msg["x-api-key"] = getConfig().apiKey;
                msg["api-version"] = getConfig().apiVersion;
                server.getSocket().request("chat.chatHandler.pushByUids", msg, (response) => {
                    if (response.code !== 200) {
                        sendMessageResponse(response, null);
                    }
                    else {
                        sendMessageResponse(null, response);
                    }
                });
            }
            else {
                console.warn("Stalk server not initialized");
            }
        }).catch((err) => {
            console.warn(err);
            getStore().dispatch(sendMessageFailure(err));
        });
    }
    else {
        if (!!server) {
            const msg = {};
            msg.data = message;
            msg["x-api-key"] = getConfig().apiKey;
            msg["api-version"] = getConfig().apiVersion;
            server.getSocket().request("chat.chatHandler.pushByUids", msg, (result) => {
                if (result.code !== 200) {
                    sendMessageResponse(result, null);
                }
                else {
                    sendMessageResponse(null, result);
                }
            });
        }
        else {
            console.warn("Stalk server not initialized");
        }
    }
}
function sendMessageResponse(err, res) {
    if (!!err) {
        getStore().dispatch(sendMessageFailure(err.message));
    }
    else {
        console.log("sendMessageResponse!", res);
        const chatroomComp = ChatRoomComponent.getInstance();
        if (res.code === HttpStatusCode.success && res.data.hasOwnProperty("resultMsg")) {
            const tempmsg = Object.assign({}, res.data.resultMsg);
            if (tempmsg.type === MessageType[MessageType.Text] && InternalStore.encryption) {
                const secure = SecureServiceFactory.getService();
                secure.decryption(tempmsg.body).then((res) => {
                    tempmsg.body = res;
                    chatroomComp.saveToPersisted(tempmsg);
                    getStore().dispatch(sendMessageSuccess());
                }).catch((err) => {
                    console.error(err);
                    tempmsg.body = err.toString();
                    chatroomComp.saveToPersisted(tempmsg);
                    getStore().dispatch(sendMessageSuccess());
                });
            }
            else {
                chatroomComp.saveToPersisted(tempmsg);
                getStore().dispatch(sendMessageSuccess());
            }
        }
        else {
            getStore().dispatch(sendMessageFailure(res.message));
        }
    }
}
const JOIN_ROOM_REQUEST = "JOIN_ROOM_REQUEST";
export const JOIN_ROOM_SUCCESS = "JOIN_ROOM_SUCCESS";
export const JOIN_ROOM_FAILURE = "JOIN_ROOM_FAILURE";
const joinRoomRequest = () => ({ type: JOIN_ROOM_REQUEST });
const joinRoomSuccess = (data) => ({ type: JOIN_ROOM_SUCCESS, payload: data });
const joinRoomFailure = (error) => ({ type: JOIN_ROOM_FAILURE, payload: error });
export function joinRoom(roomId, token, username) {
    getStore().dispatch(joinRoomRequest());
    const backendFactory = BackendFactory.getInstance();
    const server = backendFactory.getServer();
    if (!!server) {
        server.getLobby().joinRoom(token, username, roomId, (err, res) => {
            console.log("JoinChatRoomRequest value", res);
            if (err || res.code !== HttpStatusCode.success) {
                getStore().dispatch(joinRoomFailure(err));
            }
            else {
                getStore().dispatch(joinRoomSuccess());
            }
        });
    }
    else {
        getStore().dispatch(joinRoomFailure("Chat service not available."));
    }
}
export const LEAVE_ROOM = "LEAVE_ROOM";
export const LEAVE_ROOM_SUCCESS = "LEAVE_ROOM_SUCCESS";
const leaveRoom = () => ({ type: LEAVE_ROOM });
const leaveRoomSuccess = () => ({ type: LEAVE_ROOM_SUCCESS });
export function leaveRoomAction() {
    const room = getStore().getState().chatroomReducer.get("room");
    const { _id } = authReducer().user;
    if (!!room) {
        const token = getStore().getState().stalkReducer.stalkToken;
        const roomId = room._id;
        ChatRoomComponent.getInstance().dispose();
        NotificationManager.regisNotifyNewMessageEvent();
        getStore().dispatch(updateLastAccessRoom(roomId, _id));
        getStore().dispatch(leaveRoom());
    }
    else {
        getStore().dispatch({ type: "" });
    }
}
export const DISABLE_CHATROOM = "DISABLE_CHATROOM";
export const ENABLE_CHATROOM = "ENABLE_CHATROOM";
export const disableChatRoom = () => ({ type: DISABLE_CHATROOM });
export const enableChatRoom = () => ({ type: ENABLE_CHATROOM });
export const GET_PERSISTEND_CHATROOM = "GET_PERSISTEND_CHATROOM";
const GET_PERSISTEND_CHATROOM_CANCELLED = "GET_PERSISTEND_CHATROOM_CANCELLED";
export const GET_PERSISTEND_CHATROOM_SUCCESS = "GET_PERSISTEND_CHATROOM_SUCCESS";
export const GET_PERSISTEND_CHATROOM_FAILURE = "GET_PERSISTEND_CHATROOM_FAILURE";
const getPersistChatroomFail = (error) => ({ type: GET_PERSISTEND_CHATROOM_FAILURE, payload: error });
const getPersistChatroomSuccess = (roomInfo) => ({ type: GET_PERSISTEND_CHATROOM_SUCCESS, payload: roomInfo });
export const getPersistendChatroom = (roomId) => {
    getStore().dispatch({ type: GET_PERSISTEND_CHATROOM, payload: roomId });
    const { chatrooms } = getStore().getState().chatroomReducer;
    if (!chatrooms) {
        getStore().dispatch(getPersistChatroomFail(undefined));
    }
    const rooms = chatrooms.filter((room, index, array) => {
        if (room._id.toString() === roomId) {
            return room;
        }
    });
    if (rooms.length > 0) {
        getStore().dispatch(getPersistChatroomSuccess(rooms[0]));
    }
    else {
        getStore().dispatch(getPersistChatroomFail(rooms));
    }
};
export const getRoom = (roomId) => {
    const { chatrooms } = getStore().getState().chatroomReducer;
    if (!chatrooms) {
        return null;
    }
    const rooms = chatrooms.filter((room, index, array) => {
        if (room._id.toString() === roomId) {
            return room;
        }
    });
    return rooms[0];
};
export const createPrivateChatRoomMembers = (myUser, contactUser) => {
    if (myUser && contactUser) {
        const owner = {};
        owner._id = myUser._id;
        owner.user_role = (myUser.role) ? myUser.role : "user";
        owner.username = myUser.username;
        const contact = {};
        contact._id = contactUser._id;
        contact.user_role = (contactUser.role) ? contactUser.role : "user";
        contact.username = contactUser.username;
        const members = { owner, contact };
        return members;
    }
    else {
        console.warn("Not yet ready for create chatroom");
        return null;
    }
};
export const UPDATED_CHATROOMS = "UPDATED_CHATROOMS";
export const updatedChatRoomSuccess = (chatrooms) => ({ type: UPDATED_CHATROOMS, payload: chatrooms });
export const updateChatRoom = (rooms) => {
    let chatrooms = getStore().getState().chatroomReducer.get("chatrooms");
    if (chatrooms) {
        // R.unionWith(R.eqBy(R.prop('a')), l1, l2);
        const newRooms = R.unionWith(R.eqBy(R.prop("_id")), rooms, chatrooms);
        getStore().dispatch(updatedChatRoomSuccess(newRooms));
    }
    else {
        chatrooms = rooms.slice();
        getStore().dispatch(updatedChatRoomSuccess(chatrooms));
    }
};
