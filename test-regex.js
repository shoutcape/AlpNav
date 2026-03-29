const names = ["3", "3a", "3 Tuxer Fernerhaus", "3a Ahorn Skiweg", "12345", "12b something", "Ahorn"];

for (const name of names) {
  const matchOld = name.match(/^(\d+[a-zA-Z]?)\s/);
  const matchNew = name.match(/^(\d+[a-zA-Z]?)(\s|$)/);
  
  console.log(`"${name}"`);
  console.log(`  Old: ${matchOld ? matchOld[1] : 'null'}`);
  console.log(`  New: ${matchNew ? matchNew[1] : 'null'}`);
}
