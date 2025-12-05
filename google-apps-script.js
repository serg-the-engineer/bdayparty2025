/**
 * Google Apps Script для сайта приглашения на день рождения
 *
 * ИНСТРУКЦИЯ ПО НАСТРОЙКЕ:
 *
 * 1. Создайте новую Google Таблицу (Google Sheets)
 *
 * 2. Создайте два листа с именами (точно как написано):
 *    - RSVP
 *    - Topics
 *
 * 3. На листе "RSVP" создайте заголовки в первой строке:
 *    A1: guest_id
 *    B1: name
 *    C1: status
 *    D1: plus_one
 *    E1: show_public
 *    F1: timestamp
 *
 * 4. На листе "Topics" создайте заголовки в первой строке:
 *    A1: topic_id
 *    B1: text
 *    C1: author_id
 *    D1: author_name
 *    E1: likes
 *    F1: timestamp
 *
 * 5. Откройте редактор скриптов:
 *    Расширения → Apps Script
 *
 * 6. Удалите весь код в редакторе и вставьте этот файл целиком
 *
 * 7. Сохраните проект (Ctrl+S), дайте имя, например "BdayPartyAPI"
 *
 * 8. Разверните как веб-приложение:
 *    - Нажмите "Развертывание" → "Новое развертывание"
 *    - Тип: "Веб-приложение"
 *    - Описание: любое
 *    - Выполнять как: "Я"
 *    - Кто имеет доступ: "Все" (важно!)
 *    - Нажмите "Развернуть"
 *
 * 9. Скопируйте URL веб-приложения и вставьте в index.html
 *    в строку: const API_URL = 'ВСТАВИТЬ_URL_СЮДА';
 *
 * 10. При изменении кода нужно создавать НОВОЕ развертывание
 *     или обновлять существующее!
 */

// ============================================
// CONFIGURATION
// ============================================

// Получаем активную таблицу
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ============================================
// WEB APP ENDPOINTS
// ============================================

/**
 * Обработка GET запросов
 */
function doGet(e) {
  const action = e.parameter.action;
  const guestId = e.parameter.guest;

  let result;

  try {
    switch (action) {
      case 'init':
        result = handleInit(guestId);
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Обработка POST запросов
 */
function doPost(e) {
  let data;

  try {
    data = JSON.parse(e.postData.contents);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  let result;

  try {
    switch (data.action) {
      case 'rsvp':
        result = handleRsvp(data);
        break;
      case 'topic':
        result = handleAddTopic(data);
        break;
      case 'like':
        result = handleLike(data);
        break;
      default:
        result = { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// HANDLERS
// ============================================

/**
 * Инициализация - получить все данные для гостя
 */
function handleInit(guestId) {
  const rsvp = getRsvpByGuest(guestId);
  const guests = getAllConfirmedGuests();
  const topics = getAllTopics();
  const myLikes = getGuestLikes(guestId);

  return {
    success: true,
    rsvp: rsvp,
    guests: guests,
    topics: topics,
    myLikes: myLikes
  };
}

/**
 * Сохранить RSVP ответ
 */
function handleRsvp(data) {
  const { guestId, name, status, plusOne, showPublic } = data;

  if (!guestId || !name || !status) {
    return { success: false, error: 'Missing required fields' };
  }

  saveRsvp(guestId, name, status, plusOne, showPublic);
  const guests = getAllConfirmedGuests();

  return {
    success: true,
    guests: guests
  };
}

/**
 * Добавить новую тему
 */
function handleAddTopic(data) {
  const { guestId, authorName, text } = data;

  if (!guestId || !text) {
    return { success: false, error: 'Missing required fields' };
  }

  addTopic(guestId, authorName, text);
  const topics = getAllTopics();

  return {
    success: true,
    topics: topics
  };
}

/**
 * Поставить/убрать лайк
 */
function handleLike(data) {
  const { guestId, topicId, unlike } = data;

  if (!guestId || !topicId) {
    return { success: false, error: 'Missing required fields' };
  }

  toggleLike(guestId, topicId, unlike);
  const topics = getAllTopics();

  return {
    success: true,
    topics: topics
  };
}

// ============================================
// RSVP FUNCTIONS
// ============================================

/**
 * Получить RSVP по guest_id
 */
function getRsvpByGuest(guestId) {
  const sheet = getSpreadsheet().getSheetByName('RSVP');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === guestId) {
      return {
        status: data[i][2],
        plusOne: data[i][3] === true || data[i][3] === 'TRUE',
        showPublic: data[i][4] === true || data[i][4] === 'TRUE'
      };
    }
  }

  return null;
}

/**
 * Сохранить/обновить RSVP
 */
function saveRsvp(guestId, name, status, plusOne, showPublic) {
  const sheet = getSpreadsheet().getSheetByName('RSVP');
  const data = sheet.getDataRange().getValues();

  // Ищем существующую запись
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === guestId) {
      // Обновляем существующую
      sheet.getRange(i + 1, 3).setValue(status);
      sheet.getRange(i + 1, 4).setValue(plusOne);
      sheet.getRange(i + 1, 5).setValue(showPublic);
      sheet.getRange(i + 1, 6).setValue(new Date());
      return;
    }
  }

  // Добавляем новую запись
  sheet.appendRow([
    guestId,
    name,
    status,
    plusOne,
    showPublic,
    new Date()
  ]);
}

/**
 * Получить всех подтвердивших гостей
 */
function getAllConfirmedGuests() {
  const sheet = getSpreadsheet().getSheetByName('RSVP');
  const data = sheet.getDataRange().getValues();
  const guests = [];

  for (let i = 1; i < data.length; i++) {
    guests.push({
      guestId: data[i][0],
      name: data[i][1],
      status: data[i][2],
      plusOne: data[i][3] === true || data[i][3] === 'TRUE',
      showPublic: data[i][4] === true || data[i][4] === 'TRUE'
    });
  }

  return guests;
}

// ============================================
// TOPICS FUNCTIONS
// ============================================

/**
 * Добавить новую тему
 */
function addTopic(guestId, authorName, text) {
  const sheet = getSpreadsheet().getSheetByName('Topics');
  const topicId = Utilities.getUuid();

  sheet.appendRow([
    topicId,
    text,
    guestId,
    authorName,
    '[]', // пустой массив лайков
    new Date()
  ]);
}

/**
 * Получить все темы
 */
function getAllTopics() {
  const sheet = getSpreadsheet().getSheetByName('Topics');
  const data = sheet.getDataRange().getValues();
  const topics = [];

  for (let i = 1; i < data.length; i++) {
    let likes = [];
    try {
      likes = JSON.parse(data[i][4] || '[]');
    } catch (e) {
      likes = [];
    }

    topics.push({
      id: data[i][0],
      text: data[i][1],
      author: data[i][3],
      likes: likes.length
    });
  }

  return topics;
}

/**
 * Получить лайки конкретного гостя
 */
function getGuestLikes(guestId) {
  const sheet = getSpreadsheet().getSheetByName('Topics');
  const data = sheet.getDataRange().getValues();
  const likedTopics = [];

  for (let i = 1; i < data.length; i++) {
    let likes = [];
    try {
      likes = JSON.parse(data[i][4] || '[]');
    } catch (e) {
      likes = [];
    }

    if (likes.includes(guestId)) {
      likedTopics.push(data[i][0]); // topic_id
    }
  }

  return likedTopics;
}

/**
 * Поставить/убрать лайк
 */
function toggleLike(guestId, topicId, unlike) {
  const sheet = getSpreadsheet().getSheetByName('Topics');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === topicId) {
      let likes = [];
      try {
        likes = JSON.parse(data[i][4] || '[]');
      } catch (e) {
        likes = [];
      }

      const index = likes.indexOf(guestId);

      if (unlike && index > -1) {
        // Убираем лайк
        likes.splice(index, 1);
      } else if (!unlike && index === -1) {
        // Добавляем лайк
        likes.push(guestId);
      }

      sheet.getRange(i + 1, 5).setValue(JSON.stringify(likes));
      return;
    }
  }
}

// ============================================
// CORS HEADERS (для браузера)
// ============================================

/**
 * Обработка preflight запросов
 */
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}
