/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageListener } from '../../../awsq/messages/messageListener'
import { ExtensionMessage } from '../../../awsq/webview/ui/commands'
import { telemetry } from '../../../shared/telemetry/telemetry'
import { ChatControllerMessagePublishers } from '../../controllers/chat/controller'

export interface UIMessageListenerProps {
    readonly chatControllerMessagePublishers: ChatControllerMessagePublishers
    readonly webViewMessageListener: MessageListener<any>
}

export class UIMessageListener {
    private chatControllerMessagePublishers: ChatControllerMessagePublishers
    private webViewMessageListener: MessageListener<any>

    constructor(props: UIMessageListenerProps) {
        this.chatControllerMessagePublishers = props.chatControllerMessagePublishers
        this.webViewMessageListener = props.webViewMessageListener

        this.webViewMessageListener.onMessage(msg => {
            this.handleMessage(msg)
        })
    }

    private handleMessage(msg: ExtensionMessage) {
        switch (msg.command) {
            case 'chat-prompt':
                this.processChatMessage(msg)
                break
            case 'chat-answer':
                this.processChatAnswer(msg)
                break
            case 'new-tab-was-created':
                this.processNewTabWasCreated(msg)
                break
            case 'tab-was-removed':
                this.processTabWasRemoved(msg)
                break
            case 'follow-up-was-clicked':
                // TODO if another api is available for follow ups
                // connect to that instead of using prompt handler
                if (msg.followUp?.prompt !== undefined) {
                    this.processChatMessage({
                        chatMessage: msg.followUp.prompt,
                        tabID: msg.tabID,
                        command: msg.command,
                    })
                }
                break
            case 'code_was_copied_to_clipboard':
                this.processCodeWasCopiedToClipboard(msg)
                break
            case 'insert_code_at_cursor_position':
                this.processInsertCodeAtCursorPosition(msg)
                break
            case 'trigger-tabID-received':
                this.processTriggerTabIDReceived(msg)
                break
            case 'stop-response':
                this.stopResponse(msg)
                break
        }
    }

    private processTriggerTabIDReceived(msg: any) {
        this.chatControllerMessagePublishers.processTriggerTabIDReceived.publish({
            tabID: msg.tabID,
            triggerID: msg.triggerID,
        })
    }

    private processInsertCodeAtCursorPosition(msg: any) {
        // TODO add reference tracker logs if msg contains any
        this.chatControllerMessagePublishers.processInsertCodeAtCursorPosition.publish({
            tabID: msg.tabID,
            code: msg.code,
            insertionTargetType: msg.insertionTargetType,
        })
    }

    private processCodeWasCopiedToClipboard(msg: any) {
        this.chatControllerMessagePublishers.processCopyCodeToClipboard.publish({
            tabID: msg.tabID,
            code: msg.code,
            insertionTargetType: msg.insertionTargetType,
        })
    }

    private processTabWasRemoved(msg: any) {
        this.chatControllerMessagePublishers.processTabClosedMessage.publish({
            tabID: msg.tabID,
        })
    }

    private processNewTabWasCreated(msg: any) {
        telemetry.codewhispererchat_openChat.emit({ cwsprChatTriggerInteraction: 'click' })
    }

    private processChatMessage(msg: any) {
        this.chatControllerMessagePublishers.processPromptChatMessage.publish({
            message: msg.chatMessage,
            command: msg.command,
            tabID: msg.tabID,
        })
    }

    private processChatAnswer(msg: any) {
        this.chatControllerMessagePublishers.processChatAnswer.publish({
            messageLength: msg.messageLength,
            command: msg.command,
            tabID: msg.tabID,
            suggestionCount: msg.suggestionCount,
            followUpCount: msg.followUpCount,
        })
    }

    private stopResponse(msg: any) {
        this.chatControllerMessagePublishers.processStopResponseMessage.publish({
            tabID: msg.tabID,
        })
    }
}
