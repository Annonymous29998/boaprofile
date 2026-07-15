const sseClients = new Set();

function addSseClient(res) {
    sseClients.add(res);
}

function removeSseClient(res) {
    sseClients.delete(res);
}

function notifyConfigChange() {
    sseClients.forEach(function (res) {
        try {
            res.write('data: {"event":"config_updated"}\n\n');
        } catch (error) {
            sseClients.delete(res);
        }
    });
}

module.exports = {
    addSseClient,
    removeSseClient,
    notifyConfigChange
};
