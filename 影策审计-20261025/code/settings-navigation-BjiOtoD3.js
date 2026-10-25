import{n as e}from"./rolldown-runtime-DAXXjFlN.js";
function t(e,t=!1){let n=new URLSearchParams({section:e??(t?`channels`:`profile`)});
return t&&n.set(`continue`,`1`),`/settings?${n.toString()}`}function n(e){let n=t(e?.section,e?.continueCreation),r=new CustomEvent(`workspace:navigate`,{detail:{to:n},cancelable:!0});
window.dispatchEvent(r)&&window.location.assign(n)}var r=e((()=>{}));
export{n,t as r,r as t};
