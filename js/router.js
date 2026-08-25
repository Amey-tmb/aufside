/* -------------------------------- Router -------------------------------- */
export function navigate(path){
  location.hash = path;
}

export function currentPath(){
  const h = location.hash.replace(/^#/, '');
  return h || '/';
}
