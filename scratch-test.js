const content1 = '@GetMapping("/users") public void getUsers() {}';
const content2 = '@GetMapping public void getUsers() {}';
const content3 = '@PostMapping(value = "/users") public void getUsers() {}';
const content4 = '@RequestMapping("/users")';
const content5 = '@RequestMapping(value="/users", method=RequestMethod.GET)';

const routeRegex = /@(Get|Post|Put|Delete|Patch)Mapping(?:\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?["']([^"']*)["']\s*\))?/g;

function testMatch(content) {
  let match;
  console.log('Testing: ' + content);
  while((match = routeRegex.exec(content)) !== null) {
    console.log(match[1] + ' ' + (match[2] || ''));
  }
}

testMatch(content1);
testMatch(content2);
testMatch(content3);
testMatch(content4);
testMatch(content5);

