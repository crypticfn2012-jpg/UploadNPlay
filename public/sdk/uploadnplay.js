/* UploadNPlay SDK v1
 * Browser SDK for games hosted on UploadNPlay.
 * Client-side credentials are public. Never put a server API secret in a game bundle.
 */
(function (global) {
  'use strict';

  var API = 'https://rldidvwcylirjyfktvtg.supabase.co/functions/v1/uploadnplay-api';

  function fromUrl() {
    var params = new URLSearchParams(global.location.search);
    return {
      gameId: params.get('uploadnplay_game') || null,
      token: params.get('uploadnplay_token') || null,
      publicKey: params.get('uploadnplay_key') || null
    };
  }

  function UploadNPlay(options) {
    options = options || {};
    var url = fromUrl();
    this.gameId = options.gameId || url.gameId;
    this.token = options.token || url.token || null;
    this.publicKey = options.publicKey || url.publicKey || null;
    this.apiUrl = (options.apiUrl || API).replace(/\/$/, '');
  }

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
    return this.request('/me');
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

  global.UploadNPlay = UploadNPlay;
})(window);
