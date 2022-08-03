
exports = handleErrorDefault(err){
  if(err){
    console.error(err);
    return true
  }
  return false;
}