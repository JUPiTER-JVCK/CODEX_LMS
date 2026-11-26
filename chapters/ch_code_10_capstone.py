from lib import *

REFERENCE_PY = '''
class Robot:
    def __init__(self, name):
        self.name = name
        self.delivered = []

    def deliver(self, label, status):
        self.delivered.append({"label": label, "status": status})

    def summary(self):
        counts = {}
        for item in self.delivered:
            status = item["status"]
            counts[status] = counts.get(status, 0) + 1
        return counts

bit = Robot("Bit")
for label, status in [("A", "ok"), ("B", "late"), ("C", "ok"), ("D", "ok")]:
    bit.deliver(label, status)

report = bit.summary()
for status in report:
    print(f"{status}: {report[status]}")
assert report == {"ok": 3, "late": 1}
print("report checked")
'''

REFERENCE_JS = '''
class Robot {
  constructor(name) {
    this.name = name;
    this.delivered = [];
  }

  deliver(label, status) {
    this.delivered.push({ label: label, status: status });
  }

  summary() {
    const counts = {};
    for (const item of this.delivered) {
      const status = item["status"];
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }
}

const bit = new Robot("Bit");
for (const [label, status] of [["A", "ok"], ["B", "late"], ["C", "ok"], ["D", "ok"]]) {
  bit.deliver(label, status);
}

const report = bit.summary();
for (const status in report) {
  console.log(`${status}: ${report[status]}`);
}
console.assert(JSON.stringify(report) === JSON.stringify({ ok: 3, late: 1 }));
console.log("report checked");
'''

blocks = [
    P('''You now have every tool in the box: values and variables, decisions, loops, functions, lists, dictionaries, a way to find bugs, and your own objects. Now it is time to use them together, because that is what programs are:
    not one idea, but several, each doing its part. This chapter has no new ideas. It has a job. Gridtown Parcel & Co. wants Bit to work a shift, and you are the programmer.'''),

    H2('The job', 'job'),
    P('''Programs like this one are built the same way at any size. Before the first line, **decide what the pieces are**; then build and test the pieces one by one; then put them together. The table shows the plan for this shift and where
    each idea from the part earns its keep.'''),
    TABLE(['Idea', 'Chapter', 'Where it is used in the shift'], [
        ['Boxes (variables)', '[Boxes with Labels](#code-vars)', 'keeping the number of trips, the energy, a count'],
        ['Decisions', '[Decisions](#code-decide)', 'is there a parcel here? am I on the dock?'],
        ['Loops', '[Loops](#code-loops)', 'walk until the wall; repeat for each parcel'],
        ['Functions', '[Functions](#code-funcs)', '`turn_around()`, `walk(n)`: skills with names'],
        ['Lists', '[Lists](#code-lists)', 'the list of parcels, the list of results'],
        ['Dictionaries', '[Dictionaries](#code-dicts)', 'counting deliveries by status for the report'],
        ['Debugging', '[Debugging](#code-debug)', 'when a run crashes: predict, look, fix one thing'],
        ['Objects', '[Objects](#code-objects)', 'the `Robot` that remembers its own deliveries'],
    ], 'The toolbox, and where the shift uses it'),

    H2('Run 1: one delivery', 'run1'),
    P('''A parcel waits at the far end of a corridor; the dock is at the start. Bit must walk to the parcel, pick it up, **turn around**, walk back to the dock and put the parcel down. The corridor is a different length on each map, so
    count nothing: let Bit's sensors tell it when to stop. You wrote the `turn_around` skill in the Functions chapter.'''),
    BITGRID('code-10-run1', 'Run 1: one delivery',
            'Fetch the parcel from the end of the corridor and put it down on the dock (the blue square) where Bit started. Walk until Bit is on the parcel, take it, turn around, walk until it is on the dock, put it down. It has to work on every map.',
            '''
            #D>....P#
            #########
            ''', {'deliver': 'all'},
            '# Plan it first:\n#   walk until on the parcel, take it\n#   turn around\n#   walk until on the dock, put it down\n',
            '// Plan it first:\n//   walk until on the parcel, take it\n//   turn around\n//   walk until on the dock, put it down\n',
            'def turn_around():\n    turn_left()\n    turn_left()\n\nwhile not on_parcel():\n    move()\ntake()\nturn_around()\nwhile not on_dock():\n    move()\nput_down()',
            'function turnAround() {\n  turnLeft();\n  turnLeft();\n}\n\nwhile (!onParcel()) {\n  move();\n}\ntake();\nturnAround();\nwhile (!onDock()) {\n  move();\n}\nputDown();',
            hint='Two `while` loops, each stopping on a sensor: `while not on_parcel():` and `while not on_dock():`. `not` flips a yes/no answer (JavaScript: `!`). In between: `take()`, a U-turn, and at the end `put_down()`.',
            tools=['move', 'turn', 'onp', 'ond', 'take', 'put'], energy=40,
            more=['''
                  #D>.P#
                  ######
                  ''', '''
                  #D>..........P#
                  ###############
                  ''']),

    H2('Run 2: two parcels', 'run2'),
    P('''Bit can only carry **one** parcel at a time, so with two parcels it has to make two trips. The trip is the same each time, which is a loop: *repeat the delivery twice*. This is the moment the Loops and Functions chapters pay off:
    the program is the same length as for one parcel, plus a `for` and a different number.'''),
    BITGRID('code-10-run2', 'Run 2: two parcels',
            'Deliver both parcels. Bit carries one at a time. After each delivery Bit stands on the dock facing the corridor again, so each trip starts the same way. On some maps the parcels are next to each other.',
            '''
            #D>.P....P#
            ###########
            ''', {'deliver': 'all'},
            '# One trip is run 1. Do it twice.\n', '// One trip is run 1. Do it twice.\n',
            'def turn_around():\n    turn_left()\n    turn_left()\n\nfor trip in range(2):\n    while not on_parcel():\n        move()\n    take()\n    turn_around()\n    while not on_dock():\n        move()\n    put_down()\n    turn_around()',
            'function turnAround() {\n  turnLeft();\n  turnLeft();\n}\n\nfor (let trip = 0; trip < 2; trip++) {\n  while (!onParcel()) {\n    move();\n  }\n  take();\n  turnAround();\n  while (!onDock()) {\n    move();\n  }\n  putDown();\n  turnAround();\n}',
            hint='Wrap the whole of run 1 in `for trip in range(2):`. One extra line is needed at the end of each trip: turn around again so Bit faces the corridor.',
            tools=['move', 'turn', 'onp', 'ond', 'take', 'put'], energy=60,
            more=['''
                  #D>P.P#
                  #######
                  ''', '''
                  #D>.......PP#
                  #############
                  ''']),

    H2('Run 3: round the ring', 'run3'),
    P('''Now a place with a bend in it. Two parcels sit at two corners of the ring. The dock is in a third. Plan the route on paper first: how many squares between corners, where Bit takes the first parcel, which way it turns, and where it
    drops it. You are limited to **20 lines**. The route has long repeated sections, so write a skill for each repeated thing.'''),
    BITGRID('code-10-run3', 'Run 3: round the ring',
            'Bit starts facing east at the top left. Collect the parcel at the top right and deliver it to the dock at the bottom left, then fetch the second parcel at the bottom right and deliver that too. Use at most **20 lines**: you will need `walk(n)` and `turn_around()`.',
            '''
            ######
            #>..P#
            #.##.#
            #.##.#
            #D..P#
            ######
            ''', {'deliver': 'all', 'maxLines': 20},
            '# Plan: walk 3 and take the first parcel, go round to the dock, put it down,\n# then go back for the second one.\n',
            '// Plan: walk 3 and take the first parcel, go round to the dock, put it down,\n// then go back for the second one.\n',
            'def walk(n):\n    for i in range(n):\n        move()\n\ndef turn_around():\n    turn_left()\n    turn_left()\n\nwalk(3)\ntake()\nturn_right()\nwalk(3)\nturn_right()\nwalk(3)\nput_down()\nturn_around()\nwalk(3)\ntake()\nturn_around()\nwalk(3)\nput_down()',
            'function walk(n) {\n  for (let i = 0; i < n; i++) {\n    move();\n  }\n}\n\nfunction turnAround() {\n  turnLeft();\n  turnLeft();\n}\n\nwalk(3);\ntake();\nturnRight();\nwalk(3);\nturnRight();\nwalk(3);\nputDown();\nturnAround();\nwalk(3);\ntake();\nturnAround();\nwalk(3);\nputDown();',
            hint='Walk 3 and `take()`. Turn right and walk 3 (Bit passes the second parcel while carrying the first; that is fine). Turn right and walk 3 to the dock and `put_down()`. Then turn around, walk 3 to the second parcel, `take()`, turn around, walk 3 and `put_down()`.',
            tools=['move', 'turn', 'take', 'put']),
    CALLOUT('try', 'Bit stuck? Use the method', '''When a run goes wrong, **do not guess**. Press **Step** and watch Bit one command at a time. Say before each step where Bit will be. The first step where Bit does something other than you predicted is
    where the bug is, or just before it. That is the debugging loop from [chapter 8](#code-debug), and it works on a robot exactly as it works on a program.'''),

    H2('Project: the delivery log', 'project'),
    P('''Bit has been delivering parcels all shift, and the manager wants a report: how many deliveries were `ok`, how many were `late`. This is the part of a program that runs with no robot at all: records, counting and a small class. Here is a reference
    version of the whole thing, in both languages. **Run it, read it line by line**, and notice how many of the earlier chapters are in it: a class, a method, a list of dictionaries, a counting dictionary, a loop, a function that returns a result and a test.'''),
    TRY('The reference delivery log', REFERENCE_PY, REFERENCE_JS),
    PROJECT('code-10-pr-delivery-log', 'The delivery log', 'basics', 60,
            ['classes', 'lists', 'dictionaries', 'loops', 'functions', 'testing'],
            P('''Build your **own** version of the delivery log. Do not copy the reference: use it only to check your understanding. Work in a file on your Mac (a Python file you run with `python3`, or a JavaScript file you run with `node`; the
            [Setting Up Your Lab](#setup) chapter has the install steps), or in the practice areas above. Each step is small and ends with something you can run.'''),
            H3('1. Model a delivery'),
            P('''A delivery has a **label** (a string, such as `"A"`) and a **status** (`"ok"` or `"late"`). Write it as a dictionary and put four of them in a list. Print the list. This is the data your report will work on.'''),
            H3('2. Count by status'),
            P('''Write a function `summary(deliveries)` that takes your list and **returns** a dictionary with the number of deliveries for each status, for example `{"ok": 3, "late": 1}`. Use the counting pattern from the dictionaries chapter. Do not print inside the function.'''),
            H3('3. Test it'),
            P('''Write two `assert`s (or `console.assert`s) that check `summary` on a list you can count by hand, including an **empty list**, which should give an empty dictionary. Run them. Then deliberately break the function and check that a test fails.'''),
            H3('4. Wrap it in a class'),
            P('''Write a class `Robot` that is built with a `name` and keeps its own list of deliveries. Give it a method `deliver(label, status)` that adds a delivery to the list, and a method `summary()` that returns the counts. Build two robots, give each different deliveries, and check their summaries are independent.'''),
            H3('5. Print the report'),
            P('''Loop over the summary and print one line per status in the form `ok: 3`. Then add a final line that says how many deliveries there were in total and what percentage were late. (A percentage needs a division; think about whether you need a whole number or a decimal, and what happens when there are no deliveries at all.)'''),
            H3('6. Stretch goals'),
            UL('Add a third status, `"damaged"`, and check that nothing else needs to change.',
               'Make `deliver` refuse a status it does not know, with a clear error (look at how `raise` works in the Python chapters, or `throw` in JavaScript).',
               'Save the list to a JSON file and read it back (see the [JSON examples](#code-dicts) and the Python and JavaScript chapters on files).',
               'Write a function that returns the label of the *first* late delivery, or nothing if there are none.')),

    H2('What you can read now', 'read'),
    P('''Everything in the rest of the book is built from the pieces you have just used. This table says where each idea comes back, so you can see the whole book as the same few ideas in different places.'''),
    TABLE(['Idea', 'In the shell', 'In Python', 'In JavaScript and the web'], [
        ['Boxes and values', '[Shell variables](#zsh-basics)', '[Python Basics](#py-basics)', '[JavaScript Fundamentals](#js-basics)'],
        ['Decisions', '`if [[ ... ]]` in [Shell Scripting](#scripting)', '[Python Flow](#py-flow)', '[JavaScript Fundamentals](#js-basics)'],
        ['Loops', '`for` and `while` in [Shell Scripting](#scripting)', '[Python Flow](#py-flow)', '[JavaScript Fundamentals](#js-basics)'],
        ['Functions', 'shell functions in [Shell Scripting](#scripting)', '[Python Flow](#py-flow)', '[JavaScript in Depth](#js-deeper)'],
        ['Lists and dictionaries', 'arrays and associative arrays in [Shell Scripting](#scripting)', '[Python Data Structures](#py-data)', '[JavaScript in Depth](#js-deeper), JSON in [APIs](#apis)'],
        ['Debugging', '`set -x` and exit codes in [Shell Scripting](#scripting)', '[Errors, Debugging and Testing](#py-errors)', '[DevTools](#devtools)'],
        ['Objects', '(not in the shell)', '[Classes and Idiomatic Python](#py-oop)', '[The DOM](#dom): every element is an object'],
    ], 'The same ideas, later in the book'),

    H2('Where to go next', 'next'),
    P('''You can now read and write small programs in two languages, and you know the ideas well enough to learn a third in a weekend. Where next depends on what you are after.'''),
    TABLE(['If you want to', 'Go to', 'Why'], [
        ['carry on through the book in order', '[zsh Fundamentals](#zsh-basics)', 'the shell is the same ideas again, typed instead of written in a file, and everything after it (networks, servers, security) is driven from it'],
        ['go deeper in Python', '[Python Start](#py-start)', 'a full tour of the language, with the exercises that tell you whether you really have it'],
        ['build things for the browser', '[How the Web Works](#web-intro)', 'HTML and CSS give the JavaScript something to control'],
        ['understand what is behind a website', '[Server Basics](#servers) and [APIs](#apis)', 'servers are programs; APIs are functions called over a network'],
        ['practise the planning side first', '[Thinking Like a Programmer](#thinking)', 'pseudocode, flowcharts and git: the work around the code'],
    ], 'A map for your next step'),
    P('''Keep a habit that costs nothing: when you meet a new idea in the rest of the book, say which of Bit's chapters it is a version of. Most of the time the answer is "loops, with a different word".'''),

    H2('Practice', 'practice'),
    EX('code-10-ex-fizzbuzz', 'FizzBuzz', 'py',
       'Print the numbers from 1 to 15, one per line, but print `Fizz` instead of a number that is a multiple of 3, `Buzz` for a multiple of 5, and `FizzBuzz` for a multiple of both. It is the most famous programming exercise there is, because it needs a loop, decisions, a remainder and the right order of questions.',
       'for n in range(1, 16):\n    if n % 15 == 0:\n        print("FizzBuzz")\n    elif n % 3 == 0:\n        print("Fizz")\n    elif n % 5 == 0:\n        print("Buzz")\n    else:\n        print(n)',
       hints=['Ask about 15 (both) **first**. Otherwise a multiple of 15 would be caught by the 3 test and never reach the 5.'],
       why='This is an `elif` ladder in a loop. The most specific condition must come first, which is the same lesson as in the Decisions chapter.',
       starter='# print 1 to 15 with Fizz, Buzz and FizzBuzz\n',
       check='lines = out.strip().split("\\n")\nassert len(lines) == 15, "Print 15 lines."\nassert lines[:5] == ["1", "2", "Fizz", "4", "Buzz"], "The first five lines should be 1, 2, Fizz, 4, Buzz."\nassert lines[14] == "FizzBuzz", "Line 15 should be FizzBuzz."\nassert lines[9] == "Buzz" and lines[11] == "Fizz", "Check 10 and 12."'),
    EX('code-10-ex-palindrome', 'Is it a palindrome?', 'js',
       'Write a function `isPalindrome(text)` that returns `true` if the text reads the same forwards and backwards, ignoring upper and lower case, and `false` otherwise. (`"Level"` and `"noon"` are palindromes; `"robot"` is not.) You may use `text.toLowerCase()`, `.split("")`, `.reverse()` and `.join("")`, or a loop.',
       'function isPalindrome(text) {\n  const t = text.toLowerCase();\n  return t === t.split("").reverse().join("");\n}',
       hints=['Make a lower-case copy, make a reversed copy, and compare them.'],
       why='A function that returns a comparison, tested on the edges: the empty string, one letter, and different cases. Try writing the same thing with a loop that compares letters from each end.',
       starter='function isPalindrome(text) {\n  // return true or false\n}\n',
       check='assert(typeof isPalindrome === "function", "Define a function named isPalindrome.");\nassert(isPalindrome("Level") === true, "Level is a palindrome");\nassert(isPalindrome("noon") === true, "noon is a palindrome");\nassert(isPalindrome("robot") === false, "robot is not");\nassert(isPalindrome("") === true, "the empty string reads the same both ways");\nassert(isPalindrome("a") === true, "one letter");'),
    EX('code-10-ex-plan', 'Plan a program', 'think',
       ['You want a program that reads a list of temperatures taken each hour and tells you the highest, the lowest and how many readings were above 20. Before writing any code, write the plan: which variables, what loop, which decisions, and what you would make into functions.'],
       'Boxes: `highest`, `lowest` (start both at the first reading), `above` (starts at 0). One loop over the list. In the loop: if a reading is greater than `highest`, replace it; if lower than `lowest`, replace it; if above 20, add one to `above`. Three functions would help: `highest(readings)`, `lowest(readings)`, `count_above(readings, limit)`. Edge cases: an empty list (what should happen?), and a list of one.',
       hints=['Each question ("highest?", "lowest?", "how many above?") is one of the patterns you have met: a champion-so-far or a counter.'],
       why='Almost every program is a few of the patterns from this part, arranged for a purpose. Naming the patterns first makes the code short.'),
    CHECK('code-10-ch-checkpoint', 'Learn to Code review',
          Q('You need to repeat something until the way ahead is blocked, and you do not know how many steps that takes. Which tool fits?',
            [('A `while` loop that asks the sensor each time round', True), ('A `for` loop with a number you count by hand', False), ('Copying the same line many times', False), ('A dictionary', False)],
            '`while` repeats as long as something is true, which is exactly "until the way is blocked".'),
          Q('A function should give a value back so another line of code can use it. What must it do?',
            [('`return` the value, not just print it', True), ('Print it', False), ('Store it in a global box', False), ('Call itself', False)],
            '`print` shows a value to a person; `return` hands it to the program.'),
          Q('You keep a count of how many times each word appears in a text. Which collection fits best?',
            [('A dictionary: the word is the key, the count is the value', True), ('A list of numbers', False), ('A set', False), ('A single number', False)],
            'Counting by category is the dictionary\'s classic job.'),
          Q('A program runs without an error but prints a wrong total. What do you do first?',
            [('Check the values at each step (print or step through) to find where it first differs from what you expect', True), ('Rewrite it from scratch', False), ('Add more code and hope', False), ('Restart the computer', False)],
            'Logic bugs give no error message. The first place a box differs from what you expected is where to look.'),
          Q('Why might you turn a dictionary and a group of functions into a class?',
            [('The functions all work on the same data and you want the rules kept together in one place', True), ('Classes are faster', False), ('Dictionaries cannot hold text', False), ('You have to, in Python', False)],
            'A class keeps the data and the code that uses it together, so the rules (such as "energy can never go below zero") live in one place.'),
          Q('Which statement about Python and JavaScript, from this part, is true?',
            [('The ideas (boxes, decisions, loops, functions, collections, objects) are the same; the spelling differs', True), ('They have nothing in common', False), ('Only Python has loops', False), ('Only JavaScript can have functions', False)],
            'You wrote every example twice with the same structure. Learning a second language is mostly learning new spelling for ideas you already have.')),
]

terms = [
    ('capstone', 'a project that brings together everything learned in a course'),
    ('decomposition', 'breaking a big job into smaller pieces you can build and test one at a time'),
    ('pattern', 'a small reusable idea in code, such as an accumulator or a champion-so-far'),
]

CHAPTER = chapter('code-capstone', 'Capstone: Bit’s Delivery Run',
                  'Use every idea from the part together: three delivery runs for Bit and a small project that builds a delivery report with a class, a list, a dictionary and tests',
                  'code-objects', 70,
                  ['Break a job into pieces and map each piece to a tool you know',
                   'Combine loops, decisions, sensors and functions to solve a task that works on many maps',
                   'Build a small program with a class, a list of dictionaries, a counting dictionary and tests',
                   'Say where each idea comes back later in the book',
                   'Choose what to learn next'],
                  blocks, terms, level='basics', part='code', file='05.10-code-capstone.gm')
