"use strict";
if (location.hash && new URLSearchParams(location.hash.slice(1)).get("type") === "recovery") {
  location.replace("conta.html" + location.hash);
}
