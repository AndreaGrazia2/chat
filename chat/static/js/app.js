/**
 * app.js - File bridge per rendere disponibili le funzioni dei moduli
 * 
 * Questo file importa tutte le funzioni dai moduli e le rende disponibili globalmente
 */

// Importa le variabili globali
import * as globals from './modules/globals.js';

// Importa le funzioni dai moduli
import { initializeApp, setupHistoryLockFailsafe, setupEventListeners } from './modules/coreInit.js';
import { setupScrollHandlers, handleScroll, scrollToBottom } from './modules/coreScroll.js';
import { 
    loadOlderMessages, 
    loadInitialMessages, 
    loadMoreMessages, 
    resetMessages, 
    finishLoadingMore, 
    showStartOfConversation 
} from './modules/coreMessages.js';
import {
    debug,
    formatTime,
    formatDate,
    showLoader,
    hideLoader,
    linkifyText
} from './modules/utils.js';
import { createMessageElement } from './modules/messageRenderer.js';
import {
    initializeSocketIO,
    setupSocketIOEvents,
    handleSocketConnect,
    handleSocketDisconnect,
    handleMessageHistory,
    handleNewMessage,
    handleUserTyping,
    handleModelInference,
    joinChannel,
    sendDirectMessage
} from './modules/socket.js';
import {
    handleReply,
    cancelReply,
    forwardMessage,
    copyMessageText,
    editMessage,
} from './modules/messageActions.js';
import {
    sendMessage
} from './modules/chat.js';

// Rendi disponibili globalmente le variabili
Object.entries(globals).forEach(([key, value]) => {
    window[key] = value;
});

// Rendi disponibili globalmente le funzioni
// Core Init
window.initializeApp = initializeApp;
window.setupHistoryLockFailsafe = setupHistoryLockFailsafe;
window.setupEventListeners = setupEventListeners;

// Core Scroll
window.setupScrollHandlers = setupScrollHandlers;
window.handleScroll = handleScroll;
window.scrollToBottom = scrollToBottom;

// Core Messages
window.loadOlderMessages = loadOlderMessages;
window.loadInitialMessages = loadInitialMessages;
window.loadMoreMessages = loadMoreMessages;
window.resetMessages = resetMessages;
window.finishLoadingMore = finishLoadingMore;
window.showStartOfConversation = showStartOfConversation;

// Utils
window.debug = debug;
window.formatTime = formatTime;
window.formatDate = formatDate;
window.showLoader = showLoader;
window.hideLoader = hideLoader;
window.linkifyText = linkifyText;

// Message Renderer
window.createMessageElement = createMessageElement;

// Socket
window.initializeSocketIO = initializeSocketIO;
window.setupSocketIOEvents = setupSocketIOEvents;
window.handleSocketConnect = handleSocketConnect;
window.handleSocketDisconnect = handleSocketDisconnect;
window.handleMessageHistory = handleMessageHistory;
window.handleNewMessage = handleNewMessage;
window.handleUserTyping = handleUserTyping;
window.handleModelInference = handleModelInference;
window.joinChannel = joinChannel;

// Message Actions
window.handleReply = handleReply;
window.cancelReply = cancelReply;
window.forwardMessage = forwardMessage;
window.copyMessageText = copyMessageText;
window.editMessage = editMessage;
window.sendMessage = sendMessage;
window.sendDirectMessage = sendDirectMessage;

// Inizializza l'app quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
