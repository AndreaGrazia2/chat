// Import delle funzioni da testare
const { 
  initializeSocket,
  sendMessage,
  editMessage,
  deleteMessage,
  reconnectSocket,
  joinChannel,
  leaveChannel
} = require('../chat/static/js/socketio');

// Mock di Socket.IO
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
    connected: true,
    id: 'socket-123'
  };
  return jest.fn(() => mockSocket);
});

// Mock delle funzioni di utils.js
jest.mock('../chat/static/js/utils', () => ({
  debug: jest.fn(),
  showNotification: jest.fn(),
  formatTime: jest.fn(date => '12:00'),
  formatDate: jest.fn(date => 'January 1'),
  linkifyText: jest.fn(text => text)
}));

// Mock delle funzioni di app.js
jest.mock('../chat/static/js/app', () => ({
  addMessage: jest.fn(),
  updateMessage: jest.fn(),
  removeMessage: jest.fn(),
  scrollToBottom: jest.fn(),
  updateUsersList: jest.fn(),
  updateChannelsList: jest.fn(),
  updateConnectionStatus: jest.fn()
}));

describe('Socket.IO Module', () => {
  let socket;
  let io;
  
  beforeEach(() => {
    // Setup del DOM per i test
    document.body.innerHTML = `
      <div id="messageInput"></div>
      <div id="connectionStatus"></div>
      <div id="reconnectButton"></div>
    `;
    
    // Mock delle variabili globali
    global.socket = null;
    global.currentUser = { id: 'user-123', name: 'Test User' };
    global.currentChannel = 'general';
    global.isDirectMessage = false;
    global.currentlyConnected = true;
    global.console.log = jest.fn();
    
    // Inizializza il socket
    io = require('socket.io-client');
    initializeSocket();
    socket = io.mock.results[0].value;
    global.socket = socket;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('initializeSocket crea una connessione socket', () => {
    expect(io).toHaveBeenCalled();
    expect(global.socket).not.toBeNull();
  });
  
  test('initializeSocket registra gli event handler', () => {
    expect(socket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    // Aggiorna gli eventi in base a quelli effettivamente registrati in setupSocketIOEvents
    expect(socket.on).toHaveBeenCalledWith('messageHistory', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('newMessage', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('userTyping', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('modelInference', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('userStatusUpdate', expect.any(Function));
  });
  
  test('sendMessage emette un evento channelMessage', () => {
    const messageText = 'Test message';
    sendMessage(messageText);
    
    expect(socket.emit).toHaveBeenCalledWith('channelMessage', {
      channelName: 'general',
      message: {
        text: messageText,
        replyTo: null
      }
    });
  });
  
  test('editMessage emette un evento editMessage', () => {
    const messageId = 123;
    const newText = 'Edited message';
    editMessage(messageId, newText);
    
    expect(socket.emit).toHaveBeenCalledWith('editMessage', {
      id: messageId,
      text: newText,
      channel: 'general',
      isDirectMessage: false
    });
  });
  
  test('deleteMessage emette un evento deleteMessage', () => {
    const messageId = 123;
    deleteMessage(messageId);
    
    expect(socket.emit).toHaveBeenCalledWith('deleteMessage', {
      id: messageId,
      channel: 'general',
      isDirectMessage: false
    });
  });
  
  test('reconnectSocket riconnette il socket', () => {
    // Simula una disconnessione
    socket.connected = false;
    
    reconnectSocket();
    
    expect(socket.connect).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Attempting to reconnect...');
  });
  
  test('reconnectSocket non fa nulla se il socket è già connesso', () => {
    // Assicura che il socket sia connesso
    socket.connected = true;
    
    reconnectSocket();
    
    expect(socket.connect).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Socket already connected');
  });
  
  test('joinChannel emette un evento joinChannel', () => {
    const channelName = 'test-channel';
    joinChannel(channelName);
    
    expect(socket.emit).toHaveBeenCalledWith('joinChannel', channelName);
  });
  
  test('leaveChannel emette un evento leaveChannel', () => {
    const channelName = 'test-channel';
    leaveChannel(channelName);
    
    expect(socket.emit).toHaveBeenCalledWith('leaveChannel', channelName);
  });
});