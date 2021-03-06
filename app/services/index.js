export * from "./ServiceUtils";
import * as authService from "./authService";
import * as chatlogService from "./ChatlogService";
import * as chatroomService from "./ChatroomService";
import * as groupServices from "./GroupServices";
import * as messageService from "./MessageService";
import * as serviceUtils from "./ServiceUtils";
import * as userService from "./UserService";
export var Services;
(function (Services) {
    Services.AuthService = authService;
    Services.UserService = userService;
    Services.ServiceUtils = serviceUtils;
    Services.MessageService = messageService;
    Services.ChatlogService = chatlogService;
    Services.ChatroomService = chatroomService;
    Services.GroupServices = groupServices;
})(Services || (Services = {}));
