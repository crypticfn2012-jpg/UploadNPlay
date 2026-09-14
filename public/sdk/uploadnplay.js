/* UploadNPlay SDK v1
 * Browser SDK for games hosted on UploadNPlay.
 * Client-side credentials are public. Never put a server API secret in a game bundle.
 */
(function (global) {
  'use strict';

  var API = 'https://rldidvwcylirjyfktvtg.supabase.co/functions/v1/uploadnplay-api';
  var instances = [];

  function fromUrl() {
    var params = new URLSearchParams(global.location.search);
    return {
      gameId: params.get('uploadnplay_game') || null,
      token: params.get('uploadnplay_token') || null,
      publicKey: params.get('uploadnplay_key') || null
    };
  }

  function fromLaunchConfig() {
    var config = global.__UPLOADNPLAY_CONFIG;
    return config && config.source === 'uploadnplay' ? config : null;
  }

  function UploadNPlay(options) {
    options = options || {};
    var url = fromUrl();
    var launch = fromLaunchConfig();
    this.gameId = options.gameId || url.gameId || (launch && launch.gameId) || null;
    this.token = options.token || url.token || (launch && launch.token) || null;
    this.publicKey = options.publicKey || url.publicKey || (launch && launch.publicKey) || null;
    this.apiUrl = (options.apiUrl || API).replace(/\/$/, '');
    instances.push(this);
  }

  UploadNPlay.prototype.applyLaunchConfig = function (config) {
    if (!config || config.source !== 'uploadnplay') return;
    if (config.gameId) this.gameId = config.gameId;
    if (config.token) this.token = config.token;
    if (config.publicKey) this.publicKey = config.publicKey;
  };

  UploadNPlay.prototype.request = async function (path, init) {
    init = init || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers || {});
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    if (this.publicKey) headers['x-api-key'] = this.publicKey;
    var response = await fetch(this.apiUrl + path, Object.assign({}, init, { headers: headers }));
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.error || body.message || ('UploadNPlay API error (' + response.status + ')'));
    return body;
  };

  UploadNPlay.prototype.getGame = function () {
    if (!this.gameId) return Promise.reject(new Error('UploadNPlay gameId is missing.'));
    return this.request('/games/' + encodeURIComponent(this.gameId));
  };

  UploadNPlay.prototype.getPlayer = function () {
    if (!this.token) return Promise.resolve(null);
    if (!this.gameId) return Promise.reject(new Error('UploadNPlay gameId is missing.'));
    return this.request('/me?gameId=' + encodeURIComponent(this.gameId));
  };

  UploadNPlay.prototype.isSignedIn = function () {
    return !!this.token;
  };

  UploadNPlay.prototype.getAchievements = function () {
    if (!this.gameId) return Promise.reject(new Error('UploadNPlay gameId is missing.'));
    return this.request('/games/' + encodeURIComponent(this.gameId) + '/achievements');
  };

  UploadNPlay.prototype.unlockAchievement = function (achievementKey) {
    if (!this.gameId) return Promise.reject(new Error('UploadNPlay gameId is missing.'));
    if (!this.token) return Promise.reject(new Error('Player must be signed in to unlock achievements.'));
    return this.request('/games/' + encodeURIComponent(this.gameId) + '/achievements/' + encodeURIComponent(achievementKey) + '/unlock', { method: 'POST' });
  };

  UploadNPlay.prototype.on = function (event, handler) {
    if (!this._events) this._events = {};
    (this._events[event] || (this._events[event] = [])).push(handler);
    return function () {
      var list = this._events && this._events[event];
      if (!list) return;
      var index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    }.bind(this);
  };

  UploadNPlay.prototype.emit = function (event, data) {
    var list = (this._events && this._events[event]) || [];
    list.slice().forEach(function (handler) { handler(data); });
  };

  UploadNPlay.init = function (options) {
    return new UploadNPlay(options);
  };

  global.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.source !== 'uploadnplay' || data.type !== 'uploadnplay-launch') return;
    var config = {
      source: 'uploadnplay',
      gameId: data.gameId || null,
      token: data.token || null,
      publicKey: data.publicKey || null
    };
    global.__UPLOADNPLAY_CONFIG = config;
    instances.slice().forEach(function (instance) {
      instance.applyLaunchConfig(config);
      instance.emit('launch', config);
    });
  });

  global.UploadNPlay = UploadNPlay;
})(window);
