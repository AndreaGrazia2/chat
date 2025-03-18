#!/bin/bash

echo "start"

# Crea l'intestazione del file connections.js
cat > connections.js << 'EOF'
// connections.js - Gestione delle connessioni tra i nodi nel workflow

// Stato condiviso
let connections = [];
let isConnecting = false;
let connectionStart = null;
let connectionStartEl = null;
let selectedConnection = null;

// Funzione di inizializzazione
function initConnections() {
  connections = [];
  return {
    connections,
    createTempConnection,
    updateTempConnection,
    removeTempConnection,
    addConnection,
    renderConnection,
    selectConnection,
    updateConnections,
    updateConnectionPath,
    updateConnectionHitArea,
    deleteConnection,
    getSelectedConnection: () => selectedConnection,
    setSelectedConnection: (value) => selectedConnection = value,
    getIsConnecting: () => isConnecting,
    setIsConnecting: (value) => isConnecting = value,
    getConnectionStart: () => connectionStart,
    setConnectionStart: (value) => connectionStart = value,
    getConnectionStartEl: () => connectionStartEl,
    setConnectionStartEl: (value) => connectionStartEl = value
  };
}

EOF

echo "Estraendo le funzioni..."

# Estrai ogni funzione e rimuovi l'indentazione extra
sed -n '/function createTempConnection/,/^  }/p' workflow.js | sed 's/^  //' >> connections.js
echo "" >> connections.js

sed -n '/function updateTempConnection/,/^  }/p' workflow.js | sed 's/^  //' >> connections.js
echo "" >> connections.js

sed -n '/function removeTempConnection/,/^  }/p' workflow.js | sed 's/^  //' >> connections.js
echo "" >> connections.js

sed -n '/function addConnection/,/^  }/p' workflow.js | sed 's/^  //' >> connections.js
echo "" >> connections.js

sed -n '/function renderConnection/,/^  }/p' workflow.js | sed 's/^  //' >> connections.js
echo "" >> connections.js

sed -n '/function selectConnection/,/^  }/p' workflow.js | sed 's/^  //' >> connections.js
echo "" >> connections.js

sed -n '/function updateConnections/,/^  }/p' workflow.js | sed 's/^  //' >> connections.js
echo "" >> connections.js

sed -n '/function updateConnectionPath/,/^  }/p' workflow.js | sed 's/^  //' >> connections.js
echo "" >> connections.js

sed -n '/function updateConnectionHitArea/,/^  }/p' workflow.js | sed 's/^  //' >> connections.js
echo "" >> connections.js

sed -n '/function deleteConnection/,/^  }/p' workflow.js | sed 's/^  //' >> connections.js
echo "" >> connections.js

# Aggiungi l'export del modulo alla fine
cat >> connections.js << 'EOF'

// Esporta il modulo
window.connectionsModule = {
  initConnections
};
EOF

echo "File connections.js creato con successo!"