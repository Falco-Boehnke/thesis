import * as FudgeNetwork from "./../ModuleCollector";

export class Test extends FudgeNetwork.ClientManagerSinglePeer {

    constructor() {
        super();
    }

    public getLocalUserName(): string {
        console.log("testthingy");
        console.log(super.getLocalUserName);
        return "Yo";
    }
}