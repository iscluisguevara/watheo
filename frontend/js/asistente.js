/**
 * ============================================================================
 * WATHEO - Controlador del Asistente Virtual (/frontend/js/asistente.js)
 * ============================================================================
 */

(function () {
  'use strict';

  const chatMessagesEl = document.getElementById('chat-messages');
  const presetListEl = document.getElementById('preset-questions-list');
  const chatFormEl = document.getElementById('chat-form');
  const chatInputEl = document.getElementById('chat-input');
  const clearChatBtn = document.getElementById('btn-clear-chat');

  function getCurrentTimeLabel() {
    return new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date());
  }

  function appendChatMessage(sender, text) {
    if (!chatMessagesEl) {
      return;
    }

    const payload = window.WatheoApi.getSensorData();
    const mascotState = payload
      ? window.WatheoUtils.getMascotVisualState(payload.data)
      : { imagePath: '../assets/images/mascot-happy.svg' };

    const rowEl = document.createElement('div');
    rowEl.className = 'chat-message-row ' + (sender === 'bot' ? 'bot-row' : 'user-row');

    if (sender === 'bot') {
      const avatarEl = document.createElement('img');
      avatarEl.className = 'msg-avatar';
      avatarEl.src = mascotState.imagePath;
      avatarEl.alt = 'Watheo';
      rowEl.appendChild(avatarEl);
    }

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'msg-bubble';

    const textNode = document.createElement('p');
    textNode.textContent = text;
    bubbleEl.appendChild(textNode);

    const timeEl = document.createElement('span');
    timeEl.className = 'msg-time';
    timeEl.textContent =
      (sender === 'bot' ? 'Watheo • ' : 'Agricultor • ') + getCurrentTimeLabel();
    bubbleEl.appendChild(timeEl);

    rowEl.appendChild(bubbleEl);
    chatMessagesEl.appendChild(rowEl);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function updateSidebarAndMascot() {
    const payload = window.WatheoApi.getSensorData();
    if (!payload) return;
    const data = payload.data;
    const mascotState = window.WatheoUtils.getMascotVisualState(data);

    document.getElementById('assistant-mascot-img').src = mascotState.imagePath;
    document.getElementById('chat-header-avatar').src = mascotState.imagePath;

    const badgeEl = document.getElementById('assistant-mascot-badge');
    badgeEl.className = 'health-badge ' + mascotState.moodBadgeClass;
    badgeEl.textContent = mascotState.moodTitle;

    document.getElementById('chat-header-subtitle').textContent =
      data.plotName + ' • ' + mascotState.shortStatus;

    document.getElementById('assist-val-soil').textContent = data.sensors.soilMoisture + '%';
    document.getElementById('assist-val-temp').textContent = data.sensors.ambientTemperature + '°C';
    document.getElementById('assist-val-air').textContent = data.sensors.airHumidity + '%';
    document.getElementById('assist-val-relay').textContent = 'No disponible';
  }

  function renderPresetQuestions() {
    if (!presetListEl) {
      return;
    }
    presetListEl.innerHTML = '';

    const presets = window.WatheoApi.getPresetQuestions();
    presets.forEach(function (item) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-chip-btn';
      btn.innerHTML =
        '<i class="ph-fill ' + item.icon + '"></i><span>' + item.question + '</span>';

      btn.addEventListener('click', function () {
        appendChatMessage('user', item.question);
        const botAnswer = window.WatheoApi.generateAssistantReply(item.id);
        appendChatMessage('bot', botAnswer);
      });

      presetListEl.appendChild(btn);
    });
  }

  function startInitialConversation() {
    if (!chatMessagesEl) {
      return;
    }
    chatMessagesEl.innerHTML = '';

    const payload = window.WatheoApi.getSensorData();
    const mascotState = payload
      ? window.WatheoUtils.getMascotVisualState(payload.data)
      : { speechText: 'Conectando con el ESP32 a través del servidor.' };

    appendChatMessage(
      'bot',
      '¡Hola! Soy Watheo, la mascota guardiana de tu cultivo. ' + mascotState.speechText
    );

    const sampleQuestion = '¿Cómo está la humedad del suelo hoy?';
    appendChatMessage('user', sampleQuestion);
    appendChatMessage('bot', window.WatheoApi.generateAssistantReply('q_status'));
  }

  function setupEvents() {
    if (chatFormEl) {
      chatFormEl.addEventListener('submit', function (event) {
        event.preventDefault();
        const userText = chatInputEl.value.trim();
        if (!userText) {
          return;
        }
        appendChatMessage('user', userText);
        chatInputEl.value = '';

        const reply = window.WatheoApi.generateAssistantReply(userText);
        appendChatMessage('bot', reply);
      });
    }

    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', function () {
        startInitialConversation();
      });
    }
  }

  let initialRealConversationShown = false;
  window.addEventListener('watheo:updated', function () {
    updateSidebarAndMascot();
    if (!initialRealConversationShown) {
      initialRealConversationShown = true;
      startInitialConversation();
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    updateSidebarAndMascot();
    renderPresetQuestions();
    startInitialConversation();
    setupEvents();
  });
})();
