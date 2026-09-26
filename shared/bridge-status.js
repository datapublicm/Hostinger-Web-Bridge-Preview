window.BridgeStatus = {
  set(state, message) {
    const nodes = document.querySelectorAll('[data-bridge-status]');
    nodes.forEach((node) => {
      node.dataset.state = state;
      node.textContent = message;
    });
  },
  unavailable() {
    this.set('disconnected', 'Hostinger no disponible');
  }
};
