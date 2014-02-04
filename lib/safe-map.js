function Map(data) {
  this._data = data;
}

Map.prototype.get = function(key) {
  var parts = [ ].concat(key),
      result = this._data,
      i;

  try {
    for(i = 0; i < parts.length; i++) {
      if(typeof result[parts[i]] === 'undefined') {
        return undefined;
      }
      result = result[parts[i]];
    }
  } catch(e) {
    return undefined;
  }
  return result;
};

Map.prototype.set = function(key, value) {
  var parts = [ ].concat(key),
      current = this._data,
      i;
  for(i = 0; i < parts.length - 1; i++) {
    if(current[parts[i]] === null || typeof current[parts[i]] != 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  if(current[parts[i]] === null || typeof current[parts[i]] != 'object') {
    current[parts[i]] = {};
  }
  current[parts[parts.length - 1]] = value;
};

Map.prototype.toJSON = function() {
  return this._data;
};

Map.prototype.clear = function() {
  this._data = {};
};

module.exports = Map;
