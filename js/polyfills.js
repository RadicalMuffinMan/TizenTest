/**
 * Polyfills for older Chromium compatibility
 * Provides URLSearchParams, Promise, and ES6 Array/String methods for older browsers
 */

(function () {
   "use strict";

   // Array.prototype.includes polyfill (ES7)
   if (!Array.prototype.includes) {
      Array.prototype.includes = function (searchElement, fromIndex) {
         if (this == null) {
            throw new TypeError('"this" is null or not defined');
         }
         var o = Object(this);
         var len = o.length >>> 0;
         if (len === 0) return false;
         var n = fromIndex | 0;
         var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
         while (k < len) {
            if (o[k] === searchElement) return true;
            k++;
         }
         return false;
      };
   }

   // Array.prototype.find polyfill (ES6)
   if (!Array.prototype.find) {
      Array.prototype.find = function (predicate, thisArg) {
         if (this == null) {
            throw new TypeError('"this" is null or not defined');
         }
         var o = Object(this);
         var len = o.length >>> 0;
         if (typeof predicate !== "function") {
            throw new TypeError("predicate must be a function");
         }
         for (var k = 0; k < len; k++) {
            var kValue = o[k];
            if (predicate.call(thisArg, kValue, k, o)) {
               return kValue;
            }
         }
         return undefined;
      };
   }

   // Array.prototype.findIndex polyfill (ES6)
   if (!Array.prototype.findIndex) {
      Array.prototype.findIndex = function (predicate, thisArg) {
         if (this == null) {
            throw new TypeError('"this" is null or not defined');
         }
         var o = Object(this);
         var len = o.length >>> 0;
         if (typeof predicate !== "function") {
            throw new TypeError("predicate must be a function");
         }
         for (var k = 0; k < len; k++) {
            if (predicate.call(thisArg, o[k], k, o)) {
               return k;
            }
         }
         return -1;
      };
   }

   // Array.from polyfill (ES6)
   if (!Array.from) {
      Array.from = function (arrayLike, mapFn, thisArg) {
         if (arrayLike == null) {
            throw new TypeError("Array.from requires an array-like object");
         }
         var len = arrayLike.length >>> 0;
         var result = new Array(len);
         for (var i = 0; i < len; i++) {
            result[i] = mapFn
               ? mapFn.call(thisArg, arrayLike[i], i)
               : arrayLike[i];
         }
         return result;
      };
   }

   // String.prototype.includes polyfill (ES6)
   if (!String.prototype.includes) {
      String.prototype.includes = function (search, start) {
         if (typeof start !== "number") start = 0;
         if (start + search.length > this.length) return false;
         return this.indexOf(search, start) !== -1;
      };
   }

   // String.prototype.startsWith polyfill (ES6)
   if (!String.prototype.startsWith) {
      String.prototype.startsWith = function (search, pos) {
         pos = !pos || pos < 0 ? 0 : +pos;
         return this.substring(pos, pos + search.length) === search;
      };
   }

   // String.prototype.endsWith polyfill (ES6)
   if (!String.prototype.endsWith) {
      String.prototype.endsWith = function (search, thisLen) {
         if (thisLen === undefined || thisLen > this.length) {
            thisLen = this.length;
         }
         return this.substring(thisLen - search.length, thisLen) === search;
      };
   }

   // Object.assign polyfill (ES6)
   if (typeof Object.assign !== "function") {
      Object.assign = function (target) {
         if (target == null) {
            throw new TypeError("Cannot convert undefined or null to object");
         }
         var to = Object(target);
         for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];
            if (nextSource != null) {
               for (var nextKey in nextSource) {
                  if (
                     Object.prototype.hasOwnProperty.call(nextSource, nextKey)
                  ) {
                     to[nextKey] = nextSource[nextKey];
                  }
               }
            }
         }
         return to;
      };
   }

   // NodeList.prototype.forEach polyfill (ES6)
   if (typeof NodeList !== "undefined" && !NodeList.prototype.forEach) {
      NodeList.prototype.forEach = Array.prototype.forEach;
   }

   // HTMLCollection.prototype.forEach polyfill
   if (
      typeof HTMLCollection !== "undefined" &&
      !HTMLCollection.prototype.forEach
   ) {
      HTMLCollection.prototype.forEach = Array.prototype.forEach;
   }

   // Element.prototype.remove polyfill
   if (typeof Element !== "undefined" && !Element.prototype.remove) {
      Element.prototype.remove = function () {
         if (this.parentNode) {
            this.parentNode.removeChild(this);
         }
      };
   }

   // Promise polyfill for older Tizen (Chromium 47 and below)
   if (typeof Promise === "undefined") {
      window.Promise = function (executor) {
         var self = this;
         self._state = "pending";
         self._value = undefined;
         self._handlers = [];

         function resolve(value) {
            if (self._state !== "pending") return;
            self._state = "fulfilled";
            self._value = value;
            self._handlers.forEach(function (h) {
               h.onFulfilled(value);
            });
         }

         function reject(reason) {
            if (self._state !== "pending") return;
            self._state = "rejected";
            self._value = reason;
            self._handlers.forEach(function (h) {
               h.onRejected(reason);
            });
         }

         this.then = function (onFulfilled, onRejected) {
            return new Promise(function (resolve, reject) {
               function handle(value) {
                  try {
                     var result =
                        typeof onFulfilled === "function"
                           ? onFulfilled(value)
                           : value;
                     if (result && typeof result.then === "function") {
                        result.then(resolve, reject);
                     } else {
                        resolve(result);
                     }
                  } catch (e) {
                     reject(e);
                  }
               }

               function handleError(reason) {
                  try {
                     if (typeof onRejected === "function") {
                        var result = onRejected(reason);
                        if (result && typeof result.then === "function") {
                           result.then(resolve, reject);
                        } else {
                           resolve(result);
                        }
                     } else {
                        reject(reason);
                     }
                  } catch (e) {
                     reject(e);
                  }
               }

               if (self._state === "fulfilled") {
                  setTimeout(function () {
                     handle(self._value);
                  }, 0);
               } else if (self._state === "rejected") {
                  setTimeout(function () {
                     handleError(self._value);
                  }, 0);
               } else {
                  self._handlers.push({
                     onFulfilled: handle,
                     onRejected: handleError,
                  });
               }
            });
         };

         this.catch = function (onRejected) {
            return this.then(null, onRejected);
         };

         try {
            executor(resolve, reject);
         } catch (e) {
            reject(e);
         }
      };

      Promise.resolve = function (value) {
         return new Promise(function (resolve) {
            resolve(value);
         });
      };

      Promise.reject = function (reason) {
         return new Promise(function (resolve, reject) {
            reject(reason);
         });
      };

      Promise.all = function (promises) {
         return new Promise(function (resolve, reject) {
            if (!promises || !promises.length) {
               resolve([]);
               return;
            }
            var results = [];
            var completed = 0;
            promises.forEach(function (promise, index) {
               Promise.resolve(promise).then(function (value) {
                  results[index] = value;
                  completed++;
                  if (completed === promises.length) {
                     resolve(results);
                  }
               }, reject);
            });
         });
      };

      console.log("[Polyfills] Promise polyfill loaded for older Tizen");
   }

   // URLSearchParams polyfill for older Chromium versions
   if (!window.URLSearchParams) {
      window.URLSearchParams = function (search) {
         var self = this;
         self.dict = {};

         if (search) {
            // Remove leading '?' if present
            search = search.replace(/^\?/, "");

            if (search) {
               var pairs = search.split("&");
               for (var i = 0; i < pairs.length; i++) {
                  var pair = pairs[i].split("=");
                  var key = decodeURIComponent(pair[0]);
                  var value = pair[1] ? decodeURIComponent(pair[1]) : "";

                  if (!self.dict[key]) {
                     self.dict[key] = [];
                  }
                  self.dict[key].push(value);
               }
            }
         }

         this.append = function (key, value) {
            if (!self.dict[key]) {
               self.dict[key] = [];
            }
            self.dict[key].push(value);
         };

         this.delete = function (key) {
            delete self.dict[key];
         };

         this.get = function (key) {
            return self.dict[key] ? self.dict[key][0] : null;
         };

         this.getAll = function (key) {
            return self.dict[key] || [];
         };

         this.has = function (key) {
            return self.dict.hasOwnProperty(key);
         };

         this.set = function (key, value) {
            self.dict[key] = [value];
         };

         this.toString = function () {
            var pairs = [];
            for (var key in self.dict) {
               if (self.dict.hasOwnProperty(key)) {
                  var values = self.dict[key];
                  for (var i = 0; i < values.length; i++) {
                     pairs.push(
                        encodeURIComponent(key) +
                           "=" +
                           encodeURIComponent(values[i])
                     );
                  }
               }
            }
            return pairs.join("&");
         };
      };
   }
})();
