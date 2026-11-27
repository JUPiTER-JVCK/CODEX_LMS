from lib import *

blocks = [
    P('''Bit has five parcels to deliver. With the tools so far, that is five boxes called `parcel1`, `parcel2` ... `parcel5`, and then a different line of code for each one when
    it is time to deliver. Now imagine a thousand parcels. The problem is that Bit has **many things of the same kind**, and a program needs to handle them as a group. The tool is a
    **list** (JavaScript calls it an **array**): one box that holds many values in order.'''),

    H2('Many values, one name', 'why'),
    CALLOUT('why', 'Why lists exist', '''Real data comes in collections. The files in a folder, the devices on your Wi-Fi, the packets in a capture, the lines in a log file, the messages in an inbox, the squares on Bit's route. A list lets you give the whole
    collection one name and then deal with it as a unit: how many are there, what is the third, go through every one. Put a list and a loop together and the **same few lines of code
    handle ten items or ten million**. That combination is probably the most used pattern in all of programming.'''),

    H2('A shelf of boxes', 'shelf'),
    P('''Think of a shelf with numbered slots. A list is a row of boxes, and each one has a **position number**, called its **index**. You read one by writing the list's name and the index in square brackets. As in
    the last chapter, counting starts at **zero**: the first item is index 0. In the stepper the numbers are drawn above each slot, so you can see them.'''),
    STEP('Reading items by position',
         '''
         route = ["north", "east", "east"]
         first = route[0]
         last = route[2]
         print(first)
         print(len(route))
         ''',
         '''
         const route = ["north", "east", "east"];
         const first = route[0];
         const last = route[2];
         console.log(first);
         console.log(route.length);
         ''',
         {1: 'One box, three items, each with a position number above it. The first is 0, not 1.',
          2: 'Index 0 is the first item: the text {first}.', 3: 'Index 2 is the **last** of three items, because 0, 1, 2. The index of the last item is always the length minus one.',
          4: 'Show the first stop.', 5: 'How many items? Python `len(route)`; JavaScript `route.length`.'}),
    CALLOUT('gotcha', 'Counting from zero, and off the end', '''A list of 3 items has indexes 0, 1 and 2. Asking for index 3 is an error in Python (**IndexError**) and quietly gives `undefined` in JavaScript, which is worse because the problem shows up later.
    This "one too far" mistake is the most common bug in the whole subject, which is why [chapter 8](#code-debug) has a name for it (the off-by-one error). Python also lets you count **from the end**: `route[-1]` is the last item.'''),

    H2('Changing a list', 'change'),
    P('''Unlike the numbers and text you have seen so far, a list can be **changed in place**. You can add to the end, take from the end, or replace one item. The Memory panel flashes when the list changes.'''),
    STEP('Adding, replacing and removing',
         '''
         stops = ["depot", "cafe"]
         stops.append("park")
         stops[0] = "garage"
         last = stops.pop()
         print(len(stops))
         ''',
         '''
         const stops = ["depot", "cafe"];
         stops.push("park");
         stops[0] = "garage";
         const last = stops.pop();
         console.log(stops.length);
         ''',
         {1: 'Two stops.', 2: 'Add `"park"` to the end (Python `append`, JavaScript `push`). The list grows to three.',
          3: 'Put a new value in slot 0. The old one, `"depot"`, is gone.', 4: 'Remove the **last** item and hand it back, so it can be stored in `last`. The list is back to two.',
          5: 'Two items are left: the garage and the cafe.'}),
    TABLE(['You want to', 'Python', 'JavaScript'], [
        ['read item i', '`xs[i]`', '`xs[i]`'],
        ['replace item i', '`xs[i] = value`', '`xs[i] = value`'],
        ['count the items', '`len(xs)`', '`xs.length`'],
        ['add to the end', '`xs.append(v)`', '`xs.push(v)`'],
        ['remove and return the last', '`xs.pop()`', '`xs.pop()`'],
        ['is it in the list?', '`v in xs`', '`xs.includes(v)`'],
        ['an empty list', '`[]`', '`[]`'],
    ], 'The everyday list operations'),
    CALLOUT('deep', 'A `const` list can still change', '''In JavaScript `const` means the **box** can never be pointed at another list, not that the list's contents are frozen. Pushing to a `const` array is fine; assigning a different array to it is an error.
    Python has no `const`, so the question does not arise.'''),

    H2('Doing something with every item', 'each'),
    P('''To visit each item in turn, use a loop that goes through the list directly: Python's `for item in list` and JavaScript's `for (const item of list)`. You do not need an index at all. The box `w`
    receives each item in order, and this is the accumulator from the loops chapter, now fed from a list.'''),
    STEP('Add up every weight',
         '''
         weights = [4, 9, 2]
         total = 0
         for w in weights:
             total += w
         print(total)
         ''',
         '''
         const weights = [4, 9, 2];
         let total = 0;
         for (const w of weights) {
           total += w;
         }
         console.log(total);
         ''',
         {1: 'Three parcel weights in one list.', 2: 'The running total.',
          3: LOOP('Take the first item: `w` is {w}.', 'The next item: `w` is {w}.', 'The list is used up, so the loop ends.', 4),
          4: 'Add `w` to the total: now {total}.', 5: 'The list is finished. Whatever its length was, the same three lines would have worked.'}),
    TRY('Find the biggest',
        '''
        weights = [4, 9, 2, 7]
        heaviest = weights[0]
        for w in weights:
            if w > heaviest:
                heaviest = w
        print("Heaviest:", heaviest)
        ''',
        '''
        const weights = [4, 9, 2, 7];
        let heaviest = weights[0];
        for (const w of weights) {
          if (w > heaviest) {
            heaviest = w;
          }
        }
        console.log("Heaviest:", heaviest);
        '''),
    P('''Loops, decisions and boxes working together: start with the first item as the champion, and replace it whenever a bigger one turns up. Try other weights, and an empty list too. What goes wrong, and why?'''),

    H2('Searching and filtering', 'filter'),
    P('''A very common job is to build a **new** list from the items that pass a test. Start with an empty list, go through the original, and `append` the ones you want. It is the accumulator again, with a list as the
    accumulator instead of a number.'''),
    STEP('Keep only the heavy parcels',
         '''
         weights = [4, 9, 2, 7]
         heavy = []
         for w in weights:
             if w > 5:
                 heavy.append(w)
         print(len(heavy))
         ''',
         '''
         const weights = [4, 9, 2, 7];
         const heavy = [];
         for (const w of weights) {
           if (w > 5) {
             heavy.push(w);
           }
         }
         console.log(heavy.length);
         ''',
         {1: 'The original list, which never changes.', 2: 'An empty list to collect the heavy ones.',
          3: LOOP('First item: {w}.', 'Next item: {w}.', 'No more items.', 4),
          4: 'Is {w} above 5?', 5: 'Yes, so it joins the new list. Watch the new list grow.', 6: 'Two items passed the test.'}),

    H2('Two names, one list', 'alias'),
    P('''Here is the surprise that catches nearly everyone. When you write `b = a` and `a` holds a number, `b` gets its own copy of the number. But when `a` holds a **list**, `b` does not get a copy: it gets
    **the same list**. The two names are two labels on one shelf. Change the list through either name and both see it. The stepper marks this with *"same object as ..."*.'''),
    STEP('Two labels, one shelf',
         '''
         a = [1, 2, 3]
         b = a
         b.append(4)
         print(len(a))
         ''',
         '''
         const a = [1, 2, 3];
         const b = a;
         b.push(4);
         console.log(a.length);
         ''',
         {1: 'A list with three numbers.', 2: 'This does **not** copy the list. It puts a second label on the same one: Memory says so.',
          3: 'We add to the list through `b`...', 4: '...and `a` has four items. There is only one list, and both names point at it.'}),
    P('''If you want an independent copy, ask for one: `list(a)` or `a.copy()` in Python, `[...a]` in JavaScript. Then the two lists go their separate ways.'''),
    STEP('Making a real copy',
         '''
         a = [1, 2, 3]
         c = list(a)
         c.append(4)
         print(len(a))
         ''',
         '''
         const a = [1, 2, 3];
         const c = [...a];
         c.push(4);
         console.log(a.length);
         ''',
         {2: 'A **copy**: a new list with the same items. Memory no longer says "same object".', 3: 'Only the copy grows.', 4: '`a` is untouched, with its three items.'}),
    CALLOUT('why', 'Why lists are shared', '''Copying a large list every time you pass it to a function or put it in another box would be slow, so languages hand out a second label instead. It is fast and usually what you want, but it
    means a function that changes its list parameter changes the caller's list too. Remember "same object as" whenever a list changes and you did not expect it.'''),

    H2('Lists of lists', 'nested'),
    P('''A list can hold anything, including more lists. Bit's own map is exactly that: a list of rows, each row a list (or a string, which can be indexed the same way) of squares. To get one square you index twice: row first, then column.'''),
    STEP('A map in code',
         '''
         rows = ["#.#", "..G"]
         row = rows[1]
         cell = row[2]
         print(cell)
         ''',
         '''
         const rows = ["#.#", "..G"];
         const row = rows[1];
         const cell = row[2];
         console.log(cell);
         ''',
         {1: 'Two rows of three squares: wall, floor, wall, then floor, floor, goal.', 2: 'The row at index 1: the second row.', 3: 'The square at index 2 in that row: the third one, the goal pad.', 4: 'You can combine the last three steps as `rows[1][2]`.'}),

    H2('Bit follows a list', 'bit'),
    P('''The most interesting use of a list is as **data that drives the program**. Instead of a program that is a series of moves, you write a short program that reads a list of moves, and now the list is
    what changes. Each of these missions gives you a list: your job is the loop that makes sense of it.'''),
    BITGRID('code-6-route', 'Mission 1: follow the route',
            'The list `route` holds one letter per instruction: `"F"` means forward one square, `"R"` turn right, `"L"` turn left. Write a loop that goes through the list and does what each letter says.',
            '''
            ######
            #>..##
            ###.##
            ###.G#
            ######
            ''', {'at': 'G'},
            'route = ["F", "F", "R", "F", "F", "L", "F"]\n\n# go through the list and act out each letter\n',
            'const route = ["F", "F", "R", "F", "F", "L", "F"];\n\n// go through the list and act out each letter\n',
            'route = ["F", "F", "R", "F", "F", "L", "F"]\n\nfor step in route:\n    if step == "F":\n        move()\n    elif step == "R":\n        turn_right()\n    else:\n        turn_left()',
            'const route = ["F", "F", "R", "F", "F", "L", "F"];\n\nfor (const step of route) {\n  if (step === "F") {\n    move();\n  } else if (step === "R") {\n    turnRight();\n  } else {\n    turnLeft();\n  }\n}',
            hint='A loop over `route`, and inside it an `if` / `elif` / `else` on the letter: `if step == "F": move()`, and so on.', tools=['move', 'turn']),
    BITGRID('code-6-legs', 'Mission 2: a list of legs',
            'The list `legs` gives the length of each straight section of a spiral. Walk each leg, then turn right before the next. You will need a loop inside a loop: one for the list, one to move that many squares.',
            '''
            ######
            #>...#
            ####.#
            ###G.#
            ######
            ''', {'at': 'G'},
            'legs = [3, 2, 1]\n\n# for each length in the list: move that many squares, then turn right\n',
            'const legs = [3, 2, 1];\n\n// for each length in the list: move that many squares, then turn right\n',
            'legs = [3, 2, 1]\n\nfor n in legs:\n    for i in range(n):\n        move()\n    turn_right()',
            'const legs = [3, 2, 1];\n\nfor (const n of legs) {\n  for (let i = 0; i < n; i++) {\n    move();\n  }\n  turnRight();\n}',
            hint='The outer loop takes each `n` from the list. The inner loop does `move()` n times. After the inner loop, `turn_right()`.', tools=['move', 'turn']),
    BITGRID('code-6-roll-call', 'Mission 3: roll call',
            'Make Bit say every name in the list, one at a time: `Bit`, `Pip` and `Dot`.',
            '''
            ####
            #>.#
            ####
            ''', {'says': ['Bit', 'Pip', 'Dot']},
            'names = ["Bit", "Pip", "Dot"]\n\n# say each name\n',
            'const names = ["Bit", "Pip", "Dot"];\n\n// say each name\n',
            'names = ["Bit", "Pip", "Dot"]\n\nfor name in names:\n    say(name)',
            'const names = ["Bit", "Pip", "Dot"];\n\nfor (const name of names) {\n  say(name);\n}',
            hint='A `for` loop over `names`, and `say(name)` in the block.', tools=['say']),

    H2('Practice', 'practice'),
    EX('code-6-ex-total', 'Total weight', 'py',
       'Write a function `total(numbers)` that returns the sum of a list of numbers using a loop (do not use the built-in `sum`). An empty list should give 0.',
       'def total(numbers):\n    result = 0\n    for n in numbers:\n        result += n\n    return result',
       hints=['Start a box at 0 and add each number to it. Return it after the loop.'],
       why='This is the accumulator pattern wrapped in a function. Starting at 0 is why the empty list works without any special case.',
       starter='def total(numbers):\n    ...\n',
       check='assert total([4, 9, 2]) == 15, "total([4, 9, 2]) should be 15"\nassert total([]) == 0, "an empty list totals 0"\nassert total([-1, 1]) == 0, "negative numbers too"\nassert total([5]) == 5, "a list of one"'),
    EX('code-6-ex-longest', 'Longest word', 'py',
       'Write `longest(words)` that returns the longest word in a non-empty list of words. If two are equally long, return the first. (Use `len(word)`.)',
       'def longest(words):\n    best = words[0]\n    for word in words:\n        if len(word) > len(best):\n            best = word\n    return best',
       hints=['Like finding the biggest number: start with the first word as the champion and replace it when a longer one turns up.'],
       why='The "champion so far" pattern works for anything you can compare: the biggest, smallest, longest, newest. Using `>` rather than `>=` is what keeps the *first* of two equal words.',
       starter='def longest(words):\n    ...\n',
       check='assert longest(["bit", "pip", "robot"]) == "robot", "robot is the longest"\nassert longest(["ab", "cd"]) == "ab", "ties go to the first"\nassert longest(["x"]) == "x", "a list of one"'),
    EX('code-6-ex-evens', 'Keep the even numbers', 'js',
       'Write `evens(numbers)` that returns a **new** array containing only the even numbers from the array it is given, in the same order. Do not change the original array.',
       'function evens(numbers) {\n  const result = [];\n  for (const n of numbers) {\n    if (n % 2 === 0) {\n      result.push(n);\n    }\n  }\n  return result;\n}',
       hints=['The filter pattern: start with an empty array, loop, test, `push`.'],
       why='Building a new list and returning it leaves the original unchanged, so the caller can keep using it. Changing the argument in place would surprise whoever passed it in (the shared-list lesson).',
       starter='function evens(numbers) {\n  // return a new array\n}\n',
       check='assert(typeof evens === "function", "Define a function named evens.");\nconst input = [1, 2, 3, 4, 6, 7];\nconst r = evens(input);\nassert(JSON.stringify(r) === "[2,4,6]", "evens([1, 2, 3, 4, 6, 7]) should be [2, 4, 6]. Got " + JSON.stringify(r));\nassert(JSON.stringify(input) === "[1,2,3,4,6,7]", "Do not change the original array.");\nassert(JSON.stringify(evens([])) === "[]", "An empty array gives an empty array.");'),
    EX('code-6-ex-alias', 'Who changed my list?', 'think',
       ['Predict what this prints, then check by stepping it:',
        {'t': 'code', 'lang': 'text', 'attrs': {}, 'code': 'a = [1, 2, 3]\nb = a\nc = list(a)\nb.append(4)\nc.append(5)\nprint(len(a), len(b), len(c))', 'line': 1},
        'Which names point at the same list?'],
       '4 4 4. `a` and `b` are the same list, so adding 4 through `b` makes both four items long. `c` is a copy, which started with three items, and adding 5 made it four. (The lengths are all 4 by coincidence; the *contents* differ: a and b hold [1, 2, 3, 4] and c holds [1, 2, 3, 5].)',
       hints=['Draw three labels and two shelves.'],
       why='Aliasing is the thing to check when "a value changed and nothing touched it". Printing the list itself, not just its length, would have shown the difference at once.'),
    CHECK('code-6-ch-checkpoint', 'Lists checkpoint',
          Q('A list has 5 items. What is the index of the last one?',
            [('4', True), ('5', False), ('1', False), ('0', False)],
            'Indexes run from 0, so five items have indexes 0, 1, 2, 3, 4. The last index is always the length minus one.'),
          Q('After `b = a` where `a` is a list, what happens when you append to `b`?',
            [('`a` changes too, because both names point at the same list', True), ('Only `b` changes', False), ('An error: lists cannot be assigned', False), ('Nothing happens until you print them', False)],
            'Assigning a list does not copy it. If you need a separate list, ask for a copy explicitly.'),
          Q('What is the main benefit of putting items in a list instead of in separate boxes?',
            [('The same loop handles any number of them', True), ('It uses less memory', False), ('Lists are always sorted', False), ('You do not need names', False)],
            'A list lets code work on a collection of any size with the same few lines.'),
          Q('You want a new list that contains only the items that pass a test. Which pattern fits?',
            [('Start with an empty list, loop over the original, append the ones that pass', True), ('Loop over the original and delete the ones that fail', False), ('Make a copy and sort it', False), ('Use a while loop that never ends', False)],
            'Building a new list from the items you want leaves the original alone, which is almost always safer than editing it while you read it.')),

    H2('Where this goes next', 'next'),
    P('''A list finds things by **position**, and often that is not what you have. You know the name of a thing, and you want its details: the weight of the parcel labelled `A`, the address for a name. That is a
    **look-up table**, the [next chapter](#code-dicts). Lists carry on in the Python part ([Python Data Structures](#py-data): slicing, comprehensions, sorting), in JavaScript
    ([JavaScript in Depth](#js-deeper): `map`, `filter`, `reduce`) and in the shell, where a list of words is what `for f in *.log` loops over ([Shell Scripting](#scripting)).'''),
]

terms = [
    ('list', 'an ordered collection of values in one box; called an array in JavaScript'),
    ('array', 'JavaScript’s word for a list'),
    ('index', 'the position number of an item in a list, counting from zero'),
    ('element', 'one item in a list'),
    ('append / push', 'add an item to the end of a list (Python / JavaScript)'),
    ('length', 'how many items a list has; len(xs) in Python, xs.length in JavaScript'),
    ('iterate', 'to go through the items of a collection one at a time'),
    ('filter', 'build a new list from the items that pass a test'),
    ('alias', 'a second name that refers to the same list instead of a copy'),
    ('copy', 'a new, independent list with the same items'),
    ('nested list', 'a list that contains other lists'),
]

CHAPTER = chapter('code-lists', 'Lists: Many Values Under One Name',
                  'Collections in code: indexes, adding and removing, going through every item, building new lists, why two names can share one list, and a robot driven by a list',
                  'code-funcs', 50,
                  ['Make a list and read its items by position',
                   'Add, replace, remove and count items',
                   'Go through a list with a loop to total, search and filter',
                   'Explain why two names can refer to the same list, and make a real copy',
                   'Drive a program from a list of instructions'],
                  blocks, terms, level='basics', part='code', file='05.06-code-lists.gm')
