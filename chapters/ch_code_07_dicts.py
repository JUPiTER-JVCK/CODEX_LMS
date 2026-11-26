from lib import *

blocks = [
    P('''Each of Bit's parcels has a label: `A`, `B`, `C`. Each label goes with an address. Keeping the addresses in a list would mean remembering that `A` is in slot 0 and `C` in slot 2, and
    that is exactly the sort of bookkeeping computers are supposed to remove. What you want is to say "the address for `B`" and get it. That is a **dictionary**: a collection where you look
    things up by **name** instead of by position.'''),

    H2('Looking things up by name', 'why'),
    CALLOUT('why', 'Why dictionaries exist', '''A list answers "what is the third thing?". A dictionary answers "what goes with *this*?". That second question is everywhere: the settings of an app, the headers of a web request, the columns of a database row, the details of a
    user, the price of each product. Labelled data is how people naturally describe the world. Dictionaries are also **fast**: finding a key in a dictionary with a million entries takes about as long as in one with ten, while searching a list takes longer the more it holds.
    (Python calls it a **dict**; JavaScript calls the everyday version an **object**. Other languages say *map*, *hash* or *associative array*. It is one idea with many names.)'''),

    H2('Labels instead of positions', 'lookup'),
    P('''A dictionary is a set of **entries**, each a **key** and its **value**, written `key: value`. The key is what you look up; the value is what you get back. You read an entry by putting the key in square brackets, like an index,
    but the key is a label instead of a number. In the stepper a dictionary is drawn as a card with one row per entry.'''),
    STEP('A tiny address book',
         '''
         address = {"A": "Oak Street", "B": "Mill Lane"}
         where = address["B"]
         print(where)
         print(len(address))
         ''',
         '''
         const address = { A: "Oak Street", B: "Mill Lane" };
         const where = address["B"];
         console.log(where);
         console.log(Object.keys(address).length);
         ''',
         {1: 'One dictionary with two entries. Each row on the card is a key (the label) and the value it points to.',
          2: 'Look up the key `"B"`: the answer is {where}. No counting positions.', 3: 'Show it.',
          4: 'How many entries? Python `len(address)`; JavaScript counts the keys with `Object.keys(address).length`.'}),
    TABLE(['', 'Python dict', 'JavaScript object'], [
        ['make one', '`{"A": 1, "B": 2}`', '`{ A: 1, B: 2 }`'],
        ['look up', '`d["A"]`', '`d["A"]` or `d.A`'],
        ['set or change', '`d["C"] = 3`', '`d["C"] = 3`'],
        ['is the key there?', '`"A" in d`', '`"A" in d`'],
        ['remove', '`del d["A"]`', '`delete d["A"]`'],
        ['look up with a default', '`d.get("Z", 0)`', '`d["Z"] ?? 0`'],
        ['go through the entries', '`for k, v in d.items():`', '`for (const [k, v] of Object.entries(d)) {`'],
    ], 'Dictionaries side by side'),

    H2('Adding, changing, removing', 'change'),
    P('''Like a list, a dictionary can be changed in place. Assigning to a key that exists replaces its value; assigning to a key that does not exist **adds** an entry. The Memory card flashes when the dictionary changes.'''),
    STEP('Stock in the garage',
         '''
         stock = {"batteries": 3}
         stock["parcels"] = 5
         stock["batteries"] += 2
         del stock["parcels"]
         print(stock["batteries"])
         ''',
         '''
         const stock = { batteries: 3 };
         stock["parcels"] = 5;
         stock["batteries"] += 2;
         delete stock["parcels"];
         console.log(stock["batteries"]);
         ''',
         {1: 'A dictionary with one entry.', 2: 'There is no `"parcels"` key yet, so this **adds** one.', 3: 'The key exists, so this changes its value: read it, add 2, store it back (the accumulator again).',
          4: 'Remove the `"parcels"` entry altogether.', 5: 'Five batteries left.'}),
    CALLOUT('gotcha', 'Asking for a key that is not there', '''In Python `stock["tyres"]` raises a **KeyError** and stops the program. In JavaScript it quietly gives `undefined`. Neither is a surprise to the language, but both are a surprise to you. To ask safely, check first
    (`if "tyres" in stock`) or give a default, as in the table above. The right choice depends on whether a missing key is a normal case or a bug.'''),
    TRY('Safe look-up with a default',
        '''
        stock = {"batteries": 3}
        print(stock.get("batteries", 0))
        print(stock.get("tyres", 0))
        ''',
        '''
        const stock = { batteries: 3 };
        console.log(stock["batteries"] ?? 0);
        console.log(stock["tyres"] ?? 0);
        '''),

    H2('Going through a dictionary', 'loop'),
    P('''Looping over a dictionary visits its **keys**, and from each key you can look up the value. When you want both at once, ask for the pairs: `.items()` in Python, `Object.entries()` in JavaScript.'''),
    STEP('Add up the prices',
         '''
         prices = {"battery": 4, "parcel": 2}
         total = 0
         for item in prices:
             total += prices[item]
         print(total)
         ''',
         '''
         const prices = { battery: 4, parcel: 2 };
         let total = 0;
         for (const item in prices) {
           total += prices[item];
         }
         console.log(total);
         ''',
         {1: 'Two products and their prices.', 2: 'The running total.',
          3: LOOP('The first key: `item` is {item}.', 'The next key: `item` is {item}.', 'No keys left.', 4),
          4: 'Look up this key\'s value in the dictionary and add it to the total: now {total}.', 5: 'Done.'}),
    TRY('Keys and values together',
        '''
        prices = {"battery": 4, "parcel": 2}
        for item, price in prices.items():
            print(item, "costs", price)
        ''',
        '''
        const prices = { battery: 4, parcel: 2 };
        for (const [item, price] of Object.entries(prices)) {
          console.log(item, "costs", price);
        }
        '''),

    H2('Counting with a dictionary', 'count'),
    P('''Here is the most useful thing a dictionary does in practice. You have a pile of things and you want to know **how many of each kind**. Keep a dictionary where the key is the kind and the value is the count. For every
    thing: if its kind is already there, add one; if not, start it at one. Step through it and watch the card fill up.'''),
    STEP('Count the delivery outcomes',
         '''
         log = ["ok", "late", "ok", "ok", "late"]
         counts = {}
         for entry in log:
             if entry in counts:
                 counts[entry] += 1
             else:
                 counts[entry] = 1
         print(counts["ok"])
         ''',
         '''
         const log = ["ok", "late", "ok", "ok", "late"];
         const counts = {};
         for (const entry of log) {
           if (entry in counts) {
             counts[entry] += 1;
           } else {
             counts[entry] = 1;
           }
         }
         console.log(counts["ok"]);
         ''',
         {1: 'Five delivery results.', 2: 'An empty dictionary to hold the tallies.',
          3: LOOP('First entry: {entry}.', 'Next entry: {entry}.', 'All five counted.', 4),
          4: 'Have we seen this kind before? Is the key already in the dictionary?',
          5: 'Yes, so add one to its count.', 7: 'No, so this is the first of its kind: start it at 1.',
          8: 'Three results were `ok`.'}),
    CALLOUT('why', 'This is how data analysis starts', '''Counting by category is the first step of nearly every question about data: how many web requests returned each status code, which words appear most in a text, how many packets each device sent.
    You will do exactly this in the shell with `sort | uniq -c` ([The Text-Processing Toolkit](#text)), and again in Python ([Python Data Structures](#py-data) has the shortcut `Counter`). The dictionary version is what the shortcuts are doing underneath.'''),

    H2('Data inside data', 'nested'),
    P('''Values can be anything, including lists and other dictionaries, so you can describe things as detailed as you like. The most common shape is a **list of dictionaries**: a list of things, each with the same labelled details,
    like a table with one row per robot.'''),
    STEP('A fleet of robots',
         '''
         fleet = [{"name": "Bit", "energy": 20}, {"name": "Pip", "energy": 7}]
         low = 0
         for robot in fleet:
             if robot["energy"] < 10:
                 low += 1
         print(low)
         ''',
         '''
         const fleet = [{ name: "Bit", energy: 20 }, { name: "Pip", energy: 7 }];
         let low = 0;
         for (const robot of fleet) {
           if (robot["energy"] < 10) {
             low += 1;
           }
         }
         console.log(low);
         ''',
         {1: 'A list of two dictionaries. Each has the same two labels.', 2: 'Count the robots with low energy.',
          3: LOOP('First robot: `robot` is a whole dictionary.', 'Next robot.', 'Every robot has been checked.', 4),
          4: 'Look up this robot\'s `"energy"` and compare it.', 5: 'Below 10, so count it.', 6: 'One robot is running low.'}),
    P('''When data has to go from one program to another, or be saved in a file, it is turned into text. The standard text format is **JSON** (JavaScript Object Notation), and it looks almost exactly like the dictionaries and lists
    above. Python reads it with `json.loads`, JavaScript with `JSON.parse`. Both turn the text into real lists and dictionaries you can loop over. Almost every web service speaks JSON, and the [APIs chapter](#apis) is built on it.'''),
    TRY('From JSON text to a dictionary',
        '''
        import json
        text = '{"name": "Bit", "energy": 20}'
        robot = json.loads(text)
        print(robot["name"], robot["energy"])
        ''',
        '''
        const text = '{"name": "Bit", "energy": 20}';
        const robot = JSON.parse(text);
        console.log(robot["name"], robot["energy"]);
        '''),

    H2('Sets: have I seen this?', 'sets'),
    P('''One more collection, small but handy: a **set** holds values with **no duplicates** and no order. Its job is the question "is this in here?" and the answer to "how many *different* ones?". Adding something that is already
    in a set does nothing. (Python draws its sets in a sorted order; sets are officially unordered in both languages.)'''),
    STEP('How many different numbers?',
         '''
         seen = set()
         for x in [3, 1, 3, 2, 1]:
             seen.add(x)
         print(len(seen))
         ''',
         '''
         const seen = new Set();
         for (const x of [3, 1, 3, 2, 1]) {
           seen.add(x);
         }
         console.log(seen.size);
         ''',
         {1: 'An empty set.', 2: LOOP('First number: {x}.', 'Next number: {x}.', 'All five numbers have been looked at.', 3), 3: 'Add it. If it is already in the set, nothing changes: no duplicates.',
          4: 'Five numbers went in but only three different ones came out.'}),

    H2('Bit keeps records', 'bit'),
    P('''These missions are about data, not movement, so Bit stays put and **speaks**. Each one gives you data in the starter code and asks you to make Bit say something about it.'''),
    BITGRID('code-7-lookup', 'Mission 1: look up the address',
            'The dictionary `address` maps a label to a street. The parcel label is in the box `label`. Make Bit say the address for that label, and nothing else.',
            '''
            ####
            #>.#
            ####
            ''', {'says': ['Mill Lane']},
            'address = {"A": "Oak Street", "B": "Mill Lane", "C": "Quay Road"}\nlabel = "B"\n\n# make Bit say the address for this label\n',
            'const address = { A: "Oak Street", B: "Mill Lane", C: "Quay Road" };\nconst label = "B";\n\n// make Bit say the address for this label\n',
            'address = {"A": "Oak Street", "B": "Mill Lane", "C": "Quay Road"}\nlabel = "B"\n\nsay(address[label])',
            'const address = { A: "Oak Street", B: "Mill Lane", C: "Quay Road" };\nconst label = "B";\n\nsay(address[label]);',
            hint='A look-up with a box in the brackets: `address[label]`. Pass the result to `say`.', tools=['say']),
    BITGRID('code-7-count', 'Mission 2: tally the parcels',
            'The list `labels` shows the label on every parcel in the van. Count how many of each there are and make Bit say one line per label in the form `A: 3`. Build the counts with a dictionary, then loop over it.',
            '''
            ####
            #>.#
            ####
            ''', {'says': ['A: 3', 'B: 2', 'C: 1']},
            'labels = ["A", "B", "A", "C", "A", "B"]\n\n# count them in a dictionary, then say one line per label\n',
            'const labels = ["A", "B", "A", "C", "A", "B"];\n\n// count them in an object, then say one line per label\n',
            'labels = ["A", "B", "A", "C", "A", "B"]\n\ncounts = {}\nfor label in labels:\n    if label in counts:\n        counts[label] += 1\n    else:\n        counts[label] = 1\n\nfor label in counts:\n    say(f"{label}: {counts[label]}")',
            'const labels = ["A", "B", "A", "C", "A", "B"];\n\nconst counts = {};\nfor (const label of labels) {\n  if (label in counts) {\n    counts[label] += 1;\n  } else {\n    counts[label] = 1;\n  }\n}\n\nfor (const label in counts) {\n  say(`${label}: ${counts[label]}`);\n}',
            hint='The same counting loop as in the chapter. Then a second loop over the dictionary, with an f-string (or template literal) such as `{label}: {counts[label]}`.', tools=['say']),
    BITGRID('code-7-fleet', 'Mission 3: who needs a charge?',
            'The list `fleet` holds one dictionary per robot. Make Bit say the **name** of every robot whose energy is below 10, one name per `say`.',
            '''
            ####
            #>.#
            ####
            ''', {'says': ['Pip', 'Dot']},
            'fleet = [\n    {"name": "Bit", "energy": 20},\n    {"name": "Pip", "energy": 7},\n    {"name": "Dot", "energy": 3},\n]\n\n# say the name of each robot with energy below 10\n',
            'const fleet = [\n  { name: "Bit", energy: 20 },\n  { name: "Pip", energy: 7 },\n  { name: "Dot", energy: 3 },\n];\n\n// say the name of each robot with energy below 10\n',
            'fleet = [\n    {"name": "Bit", "energy": 20},\n    {"name": "Pip", "energy": 7},\n    {"name": "Dot", "energy": 3},\n]\n\nfor robot in fleet:\n    if robot["energy"] < 10:\n        say(robot["name"])',
            'const fleet = [\n  { name: "Bit", energy: 20 },\n  { name: "Pip", energy: 7 },\n  { name: "Dot", energy: 3 },\n];\n\nfor (const robot of fleet) {\n  if (robot["energy"] < 10) {\n    say(robot["name"]);\n  }\n}',
            hint='A loop over `fleet`; inside it, `if robot["energy"] < 10:` then `say(robot["name"])`.', tools=['say']),

    H2('List or dictionary?', 'choose'),
    TABLE(['If you have...', 'Use', 'Because'], [
        ['an ordered sequence, or order matters', 'a list', 'position is the meaning: the route, the queue, the lines of a file'],
        ['things you look up by name or label', 'a dictionary', 'the label is the meaning: address by parcel, price by product'],
        ['a collection of the same kind of thing', 'a list', 'a list of robots, a list of numbers'],
        ['one thing with several named details', 'a dictionary', 'a robot with a name and an energy'],
        ['only "have I seen this?" matters', 'a set', 'duplicates vanish, membership is quick'],
    ], 'Choosing a collection'),

    H2('Practice', 'practice'),
    EX('code-7-ex-count-letters', 'Count the letters', 'py',
       'Write `count_letters(word)` that returns a **dictionary** with each letter of the word as a key and the number of times it appears as the value. For `"robot"` the answer has `"o": 2` and `"r": 1`.',
       'def count_letters(word):\n    counts = {}\n    for letter in word:\n        if letter in counts:\n            counts[letter] += 1\n        else:\n            counts[letter] = 1\n    return counts',
       hints=['Looping over a string gives one letter at a time, like a list. Then it is the counting pattern.'],
       why='The counting pattern works on anything you can loop over: letters, words, log lines, packets. The only part that changes is what you use as the key.',
       starter='def count_letters(word):\n    ...\n',
       check='assert count_letters("robot") == {"r": 1, "o": 2, "b": 1, "t": 1}, "count_letters(\\"robot\\") is wrong"\nassert count_letters("") == {}, "an empty word gives an empty dictionary"\nassert count_letters("aaa") == {"a": 3}, "three of the same letter"'),
    EX('code-7-ex-cheapest', 'The cheapest item', 'py',
       'The dictionary `prices` maps product names to prices. Print the **name** of the cheapest product. (Loop over the keys, and keep track of the best one so far.)',
       'prices = {"battery": 4, "parcel": 2, "tyre": 9}\nbest = None\nfor item in prices:\n    if best is None or prices[item] < prices[best]:\n        best = item\nprint(best)',
       hints=['The "champion so far" pattern: `best` starts as nothing, and a key replaces it when its price is lower.'],
       why='You can compare *values* by looking each one up from its key. `is None` is how you test for "nothing yet" without confusing it with 0 or an empty string.',
       starter='prices = {"battery": 4, "parcel": 2, "tyre": 9}\n# print the name of the cheapest product\n',
       check='assert out.strip() == "parcel", "The cheapest product is parcel."'),
    EX('code-7-ex-total', 'Total value', 'js',
       'Write `totalValue(stock)` that takes an object mapping product names to **quantities** and a second object `prices`, and returns the total value: the sum of `stock[name] * prices[name]` over every product in `stock`.',
       'function totalValue(stock, prices) {\n  let total = 0;\n  for (const name in stock) {\n    total += stock[name] * prices[name];\n  }\n  return total;\n}',
       hints=['Loop over the keys of `stock`; for each, multiply its quantity by the price with the same key.'],
       why='Two dictionaries can share keys, so one loop can join them: the key is the thing that links the data. Databases and spreadsheets do the same when they join tables.',
       starter='function totalValue(stock, prices) {\n  // return the total value\n}\n',
       check='assert(typeof totalValue === "function", "Define a function named totalValue.");\nassert(totalValue({ battery: 3, parcel: 5 }, { battery: 4, parcel: 2 }) === 22, "3 batteries at 4 plus 5 parcels at 2 is 22");\nassert(totalValue({}, { battery: 4 }) === 0, "No stock is worth 0.");'),
    EX('code-7-ex-choose', 'List or dictionary?', 'think',
       ['For each of these, say whether you would use a list, a dictionary or a set, and what the keys would be if it is a dictionary:',
        '1. The order of stops on a delivery route.\n2. The phone number for each of your contacts.\n3. Which parcels have already been delivered (you only ever ask "has this one been done?").\n4. The temperature at each hour of the day, where you mostly read them in time order.'],
       '1. A list: the order is the whole point. 2. A dictionary: name is the key, number is the value. 3. A set: membership is the only question, and duplicates would be meaningless. 4. A list: it is ordered and you read it in order (a dictionary keyed by hour would also work if you mostly look up a particular hour).',
       hints=['Ask: do I find it by position, by name, or just ask whether it is there?'],
       why='Choosing the collection is half the design of a program. The same data in the wrong shape needs far more code to use.'),
    CHECK('code-7-ch-checkpoint', 'Dictionaries checkpoint',
          Q('What do you use to read a value out of a dictionary?',
            [('The key', True), ('The position number, like a list', False), ('The value', False), ('The length', False)],
            'A dictionary is looked up by key. The value is what you get back.'),
          Q('In Python, what does `stock["tyres"]` do if there is no `"tyres"` key?',
            [('Raises a KeyError and stops the program', True), ('Returns 0', False), ('Returns an empty string', False), ('Adds the key with value None', False)],
            'Python is strict about missing keys. Use `"tyres" in stock` or `stock.get("tyres", 0)` when a missing key is a normal case. (JavaScript gives `undefined` instead.)'),
          Q('You have a list of words and want to know how many times each appears. Which tool fits?',
            [('A dictionary: word as key, count as value', True), ('A second list of the same length', False), ('A set', False), ('A nested loop with no data structure', False)],
            'Counting by category is the classic job of a dictionary.'),
          Q('What is JSON?',
            [('A text format for lists and dictionaries that programs use to exchange data', True), ('A programming language', False), ('A kind of loop', False), ('A type of number', False)],
            'JSON writes down the same lists, dictionaries, numbers, text and true/false values you have been using, as plain text any language can read.')),

    H2('Where this goes next', 'next'),
    P('''You now have the main tools: boxes, decisions, loops, functions, lists and dictionaries. Next comes something every programmer meets daily and no course can avoid: things go wrong. The [next chapter](#code-debug) is about reading error messages,
    finding bugs methodically and writing code that is harder to get wrong. After that, [one chapter on objects](#code-objects) shows how to build your own kinds of thing, and then the capstone puts everything together. For the full set of tools,
    see [Python Data Structures](#py-data) and [JavaScript in Depth](#js-deeper), and for JSON in the wild, the [APIs chapter](#apis) and [XML and Friends](#xml).'''),
]

terms = [
    ('dictionary', 'a collection that stores values under keys so you can look them up by name; dict in Python'),
    ('object (JavaScript)', 'the everyday JavaScript kind of dictionary: named properties with values'),
    ('key', 'the label you use to look a value up'),
    ('entry', 'one key and its value'),
    ('KeyError', 'the Python error for asking a dictionary for a key it does not have'),
    ('default value', 'a value used when a key is missing'),
    ('JSON', 'JavaScript Object Notation: a text format for lists, dictionaries, numbers, text and true/false that programs use to exchange data'),
    ('set', 'a collection of unique values with no order'),
    ('nested data', 'data inside data, such as a list of dictionaries'),
]

CHAPTER = chapter('code-dicts', 'Look-up Tables: Dictionaries and Objects',
                  'Storing and finding data by name: dictionaries, counting, nested data, JSON and sets, and choosing the right collection',
                  'code-lists', 50,
                  ['Store and look up values by key',
                   'Add, change and remove entries, and handle a missing key',
                   'Loop through a dictionary and count things with one',
                   'Combine lists and dictionaries into nested data, and recognise JSON',
                   'Choose between a list, a dictionary and a set'],
                  blocks, terms, level='basics', part='code', file='05.07-code-dicts.gm')
