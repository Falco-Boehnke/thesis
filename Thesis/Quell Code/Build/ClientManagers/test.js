"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const FudgeNetwork = __importStar(require("./../ModuleCollector"));
class Test extends FudgeNetwork.ClientManagerSinglePeer {
    constructor() {
        super();
    }
    getLocalUserName() {
        console.log("testthingy");
        console.log(super.getLocalUserName);
        return "Yo";
    }
}
exports.Test = Test;
