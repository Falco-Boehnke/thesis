import WebSocket from "ws";
import * as FudgeNetwork from "../ModuleCollector";
import { UiElementHandler } from "../DataHandling";
import { NetworkMessageMessageToServer, NetworkMessageMessageToClient } from "../NetworkMessages";

export class FudgeServerWebSocket implements FudgeNetwork.WSServer {
    public websocketServer!: WebSocket.Server;
    public connectedClientsCollection: FudgeNetwork.ClientDataType[] = new Array();

    public startUpServer = (_serverPort?: number) => {

        if (!_serverPort) {
            this.websocketServer = new WebSocket.Server({ port: 8080 });
            console.log("Server gestartet an Port: " + 8080);
        }
        else {
            this.websocketServer = new WebSocket.Server({ port: _serverPort });
            console.log("Server gestartet an Port: " + _serverPort);

        }
        this.addServerEventHandling();
    }

    public closeDownServer = () => {
        this.websocketServer.close();
    }
    public addServerEventHandling = (): void => {
        // tslint:disable-next-line: no-any
        this.websocketServer.on("connection", (_websocketClient: any) => {
            console.log("User connected to P2P SignalingServer");

            try {
                const uniqueIdOnConnection: string = this.createID();
                this.sendTo(_websocketClient, new FudgeNetwork.NetworkMessageIdAssigned(uniqueIdOnConnection));
                const freshlyConnectedClient: FudgeNetwork.ClientDataType = new FudgeNetwork.ClientDataType(_websocketClient, uniqueIdOnConnection);
                this.connectedClientsCollection.push(freshlyConnectedClient);
            } catch (error) {
                console.error("Unhandled Exception SERVER: Sending ID to ClientDataType", error);
            }


            _websocketClient.on("message", (_message: string) => {
                this.serverDistributeMessageToAppropriateMethod(_message, _websocketClient);
            });

            _websocketClient.addEventListener("close", () => {
                console.error("Error at connection");
                for (let i: number = 0; i < this.connectedClientsCollection.length; i++) {
                    if (this.connectedClientsCollection[i].clientConnection === _websocketClient) {
                        console.log("FudgeNetwork.ClientDataType found, deleting");
                        this.connectedClientsCollection.splice(i, 1);
                        console.log(this.connectedClientsCollection);
                    }
                    else {
                        console.log("Wrong client to delete, moving on");
                    }
                }
            });

        });
    }

    // TODO Check if event.type can be used for identification instead => It cannot
    public serverDistributeMessageToAppropriateMethod(_message: string, _websocketClient: WebSocket): void {
        let objectifiedMessage: FudgeNetwork.NetworkMessageMessageBase = <FudgeNetwork.NetworkMessageMessageBase>this.parseMessageFromJson(_message);
        if (!objectifiedMessage.messageType) {
            console.error("Unhandled Exception: Invalid Message Object received. Does it implement MessageBase?");
            return;
        }
        console.log(objectifiedMessage, _message);
        if (objectifiedMessage != null) {
            switch (objectifiedMessage.messageType) {
                case FudgeNetwork.MESSAGE_TYPE.ID_ASSIGNED:
                    console.log("Id confirmation received for client: " + objectifiedMessage.originatorId);
                    break;

                case FudgeNetwork.MESSAGE_TYPE.LOGIN_REQUEST:
                    this.addUserOnValidLoginRequest(_websocketClient, <FudgeNetwork.NetworkMessageLoginRequest>objectifiedMessage);
                    break;

                case FudgeNetwork.MESSAGE_TYPE.CLIENT_TO_SERVER_MESSAGE:
                    this.displayMessageOnServer(<NetworkMessageMessageToServer>objectifiedMessage);
                    this.broadcastMessageToAllConnectedClients(<NetworkMessageMessageToClient>objectifiedMessage);
                    break;

                default:
                    console.log("Message type not recognized");
                    break;

            }
        }
    }
    displayMessageOnServer(_objectifiedMessage: FudgeNetwork.NetworkMessageMessageToServer): void {
        if (UiElementHandler.webSocketServerChatBox != null || undefined) {
            UiElementHandler.webSocketServerChatBox.innerHTML += "\n" + _objectifiedMessage.originatorUserName + ": " + _objectifiedMessage.messageData;
        }
        else {
            console.log("To display the message, add appropriate UiElemenHandler object");
        }
    }

    //#region MessageHandler
    public addUserOnValidLoginRequest(_websocketConnection: WebSocket, _messageData: FudgeNetwork.NetworkMessageLoginRequest): void {
        let usernameTaken: boolean = true;
        usernameTaken = this.searchUserByUserNameAndReturnUser(_messageData.loginUserName, this.connectedClientsCollection) != null;
        try {
            if (!usernameTaken) {
                const clientBeingLoggedIn: FudgeNetwork.ClientDataType = this.searchUserByWebsocketConnectionAndReturnUser(_websocketConnection, this.connectedClientsCollection);

                if (clientBeingLoggedIn != null) {
                    clientBeingLoggedIn.userName = _messageData.loginUserName;
                    this.sendTo(_websocketConnection, new FudgeNetwork.NetworkMessageLoginResponse(true, clientBeingLoggedIn.id, clientBeingLoggedIn.userName));
                }
            } else {
                this.sendTo(_websocketConnection, new FudgeNetwork.NetworkMessageLoginResponse(false, "", ""));
                usernameTaken = true;
                console.log("UsernameTaken");
            }
        } catch (error) {
            console.error("Unhandled Exception: Unable to create or send LoginResponse", error);
        }
    }

    public broadcastMessageToAllConnectedClients(_messageToBroadcast: FudgeNetwork.NetworkMessageMessageToClient): void {
        let clientArray: WebSocket[] = Array.from(this.websocketServer.clients);

        clientArray.forEach(_client => {
            this.sendTo(_client, _messageToBroadcast);
        });
    }


    public searchForClientWithId(_idToFind: string): FudgeNetwork.ClientDataType {
        return this.searchForPropertyValueInCollection(_idToFind, "id", this.connectedClientsCollection);
    }

    public createID = (): string => {
        // Math.random should be random enough because of it's seed
        // convert to base 36 and pick the first few digits after comma
        return "_" + Math.random().toString(36).substr(2, 7);
    }
    //#endregion


    public parseMessageFromJson(_messageToParse: string): FudgeNetwork.NetworkMessageMessageBase {
        let parsedMessage: FudgeNetwork.NetworkMessageMessageBase = { originatorId: " ", messageType: FudgeNetwork.MESSAGE_TYPE.UNDEFINED };

        try {
            parsedMessage = JSON.parse(_messageToParse);
        } catch (error) {
            console.error("Invalid JSON", error);
        }
        return parsedMessage;
    }

    public stringifyObjectToString = (_objectToStringify: Object): string => {
        return JSON.stringify(_objectToStringify);
    }
    // TODO Type Websocket not assignable to type WebSocket ?!
    // tslint:disable-next-line: no-any
    public sendTo = (_connection: any, _message: Object | string) => {
        let stringifiedMessage: string = "";
        if (typeof (_message) == "object") {
            stringifiedMessage = JSON.stringify(_message);
        }
        else if (typeof (_message) == "string") {
            stringifiedMessage = _message;
        }
        _connection.send(stringifiedMessage);
    }

    // Helper function for searching through a collection, finding objects by key and value, returning
    // Object that has that value
    // tslint:disable-next-line: no-any
    private searchForPropertyValueInCollection = (propertyValue: any, key: string, collectionToSearch: any[]) => {
        for (const propertyObject in collectionToSearch) {
            if (this.connectedClientsCollection.hasOwnProperty(propertyObject)) {
                // tslint:disable-next-line: typedef
                const objectToSearchThrough = collectionToSearch[propertyObject];
                if (objectToSearchThrough[key] === propertyValue) {
                    return objectToSearchThrough;
                }
            }
        }
        return null;
    }

    private searchUserByUserNameAndReturnUser = (_userNameToSearchFor: string, _collectionToSearch: FudgeNetwork.ClientDataType[]): FudgeNetwork.ClientDataType => {
        return this.searchForPropertyValueInCollection(_userNameToSearchFor, "userName", _collectionToSearch);
    }
    private searchUserByUserIdAndReturnUser = (_userIdToSearchFor: string, _collectionToSearch: FudgeNetwork.ClientDataType[]): FudgeNetwork.ClientDataType => {
        return this.searchForPropertyValueInCollection(_userIdToSearchFor, "id", _collectionToSearch);
    }

    private searchUserByWebsocketConnectionAndReturnUser = (_websocketConnectionToSearchFor: WebSocket, _collectionToSearch: FudgeNetwork.ClientDataType[]) => {
        return this.searchForPropertyValueInCollection(_websocketConnectionToSearchFor, "clientConnection", _collectionToSearch);
    }
}