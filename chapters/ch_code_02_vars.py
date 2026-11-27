from lib import *

blocks = [
    P('''In the last chapter Bit did what you said and then forgot all about it. That is fine for walking down a corridor and useless for
    anything else. How much energy is left? What was the starting square? What did the user type? A program needs somewhere to keep
    answers while it works. This chapter is about the oldest and most important idea in code: the **variable**, a box with a label on
    it, where the program keeps a value so it can use it again.'''),

    H2('Why programs need memory', 'why'),
    P('''Think of the jars in a kitchen. The label on the jar says `sugar`. You do not need to remember where the sugar is or how much
    there is: you ask for "the sugar" by name and take what is inside. Tomorrow the jar may hold different sugar, and the label
    still works. A variable is a jar like that. The **name** is the label, and the **value** is what is inside right now.'''),
    CALLOUT('why', 'Why variables exist', '''Two jobs. First, **remembering**: a program works in steps, and the answer to step 3 is needed in step 9, so it has to be
    put somewhere. Second, **naming**: if the number 20 appears in forty places and the rule changes to 25, you have to find and
    change forty numbers and you will miss one. If the rule lives in one box called `energy`, you change one line. A good name also
    tells the next reader what the number *means*, which `20` never can.'''),

    H2('A box with a label', 'box'),
    P('''You make a variable by choosing a name and putting a value in it with `=`. This is called **assignment**. The step-through below
    makes three boxes. Watch the Memory panel: each box appears the moment its line has run, and the picture of the value tells you
    what *kind* of value it is (more on that in a moment).'''),
    STEP('Putting things in boxes',
         '''
         robot = "Bit"
         energy = 20
         carrying = False
         print(robot)
         print(energy)
         ''',
         '''
         let robot = "Bit";
         let energy = 20;
         let carrying = false;
         console.log(robot);
         console.log(energy);
         ''',
         {1: 'Make a box labelled `robot` and put the text {robot} in it. In JavaScript `let` is the word that makes a new box.',
          2: 'A second box, `energy`, holds the number {energy}. Numbers have no quotation marks.',
          3: 'A third box holds a yes/no value, shown as a switch. Python spells it `False`, JavaScript `false`.',
          4: 'Using a box is just writing its name. The computer looks inside and shows what it finds.',
          5: 'Same again for `energy`. Notice that the *name* is in the code and the *value* is what comes out.',
          'end': 'Three boxes, three kinds of value, nothing lost. The names stay, and the contents can change later.'}),
    CALLOUT('gotcha', '`=` does not mean "equals"', '''In maths, `x = 5` states a fact. In code, `energy = 20` is an **instruction**: *work out the right-hand side, then put the result in the box on the
    left*. Read it as "energy becomes 20". The arrow only goes one way, which is why `20 = energy` is an error. When you need to *ask* whether two things are
    equal, there is a different symbol (`==`, in [the next chapter](#code-decide)).'''),

    H2('Kinds of values', 'kinds'),
    P('''Every value has a **type**, a kind of thing it is, and the kind decides what you can do with it. You can add two numbers but
    not two sentences. You can shout a piece of text but not a number. The four kinds you will use constantly:'''),
    TABLE(['Kind', 'What it holds', 'Python', 'JavaScript', 'Picture in Memory'], [
        ['Whole number', 'counting things: 0, 7, -3', '`7`', '`7`', 'a number tile'],
        ['Decimal number', 'measuring things: 2.5', '`2.5`', '`2.5`', 'a number tile'],
        ['Text (string)', 'any characters in quotation marks', '`"Bit"`', '`"Bit"`', 'a text tile'],
        ['True/False (boolean)', 'a yes/no answer', '`True`, `False`', '`true`, `false`', 'a switch'],
        ['Nothing', '"no value yet"', '`None`', '`null`', 'an italic grey word'],
    ], 'The basic kinds of value'),
    STEP('Boxes of every kind',
         '''
         parcels = 3
         distance = 2.5
         label = "FRAGILE"
         ready = True
         owner = None
         print(label)
         ''',
         '''
         let parcels = 3;
         let distance = 2.5;
         let label = "FRAGILE";
         let ready = true;
         let owner = null;
         console.log(label);
         ''',
         {1: 'A whole number: a count of parcels.', 2: 'A decimal number: a distance in kilometres.',
          3: 'Text. Quotation marks are what tell the computer "this is words, not a name".', 4: 'A yes/no value, drawn as a switch.',
          5: '"Nothing yet": the box exists but has no real value. Python calls it `None`, JavaScript `null`.',
          6: 'Only text is printed here, but all five boxes stay in memory.'}),
    CALLOUT('deep', 'Text that looks like a number', '''`"5"` (with quotation marks) is **text** that happens to be the character 5. `5` is the number. They look alike on the screen and
    behave differently: adding two numbers gives a number, and the two languages disagree about what happens when you mix them. See
    the box at the end of this chapter.'''),

    H2('Using the boxes', 'use'),
    P('''Once a value is in a box you use it by writing the name. Anywhere you could write a value you can write a box: the computer
    swaps in what is inside. Combining values with operators (`+`, `-`, `*`) is called an **expression**; the computer works the
    expression out and you can store the result in another box. Try the program, then change the numbers and run it again.'''),
    TRY('Arithmetic with boxes',
        '''
        parcels = 7
        weight = 4
        print(parcels * weight)
        print(parcels + weight)
        print(parcels - weight)
        print(17 % 5)
        print(7 / 2)
        ''',
        '''
        let parcels = 7;
        let weight = 4;
        console.log(parcels * weight);
        console.log(parcels + weight);
        console.log(parcels - weight);
        console.log(17 % 5);
        console.log(7 / 2);
        '''),
    TABLE(['You want', 'Write', 'Notes'], [
        ['add, subtract', '`+`  `-`', 'the same in both languages'],
        ['multiply', '`*`', 'the same in both languages'],
        ['divide', '`/`', 'always gives a decimal in Python (`10 / 2` is `5.0`); JavaScript prints `5`'],
        ['remainder', '`%`', '`17 % 5` is 2: what is left after taking out as many 5s as fit'],
        ['power', '`**`', '`2 ** 3` is 8 in both'],
        ['whole-number division', '`//` in Python', 'JavaScript: `Math.floor(a / b)`'],
    ], 'Arithmetic'),
    P('''Text has its own tools. The most useful is putting values *inside* a sentence. Python calls it an **f-string** (put an `f` in
    front of the quotation marks) and JavaScript a **template literal** (use backticks). In both, a name in curly braces is replaced by
    what is in the box.'''),
    STEP('Building a sentence',
         '''
         robot = "Bit"
         energy = 20
         message = f"{robot} has {energy} energy"
         print(message)
         ''',
         '''
         const robot = "Bit";
         const energy = 20;
         const message = `${robot} has ${energy} energy`;
         console.log(message);
         ''',
         {1: 'A text box.', 2: 'A number box. (In JavaScript `const` means a box whose value will never change; `let` means it might.)',
          3: 'The computer reads the sentence, swaps each name in curly braces for what is in that box, and stores the finished sentence in a new box.',
          4: 'Show the finished sentence.'}),
    TRY('Try your own sentence',
        '''
        robot = "Bit"
        energy = 20
        print(f"{robot} has {energy} energy left")
        print(f"After one move: {energy - 1}")
        ''',
        '''
        const robot = "Bit";
        const energy = 20;
        console.log(`${robot} has ${energy} energy left`);
        console.log(`After one move: ${energy - 1}`);
        '''),
    P('''Inside the braces you can put a whole expression, not just a name, as the second line shows.'''),

    H2('Changing a box', 'change'),
    P('''The word *variable* means that the contents can **vary**. Put a new value in a box and the old one is gone. The common pattern
    is to compute the new value *from* the old one: `energy = energy - 1`. This is not a claim that a number equals itself minus
    one. It says: look in the box, subtract one, put the answer back in the same box. The shorter `energy -= 1` does the same and
    works in both languages. Step through Bit's morning and watch the one box change.'''),
    STEP('One box, many values',
         '''
         energy = 10
         energy -= 1
         energy -= 1
         energy += 5
         print("Energy:", energy)
         ''',
         '''
         let energy = 10;
         energy -= 1;
         energy -= 1;
         energy += 5;
         console.log("Energy:", energy);
         ''',
         {1: 'Start with {energy} in the box.', 2: 'Read the box, subtract 1, put the answer back: now {energy}. The box lights up when its value changes.',
          3: 'Again: now {energy}.', 4: 'Bit picks up a battery: add 5, and the box holds {energy}.', 5: 'Show whatever is in the box now.',
          'end': 'Ten became nine, then eight, then thirteen, all in the same box. The program only ever has the *latest* value.'}),
    CALLOUT('try', 'Predict before you press Next', '''Cover the Memory panel with your hand and, before each Next, say what the box will hold afterwards. When you are right every time, you
    can read code. When you are wrong, the stepper shows exactly which instruction did something you did not expect.'''),

    H2('Choosing good names', 'names'),
    P('''The computer does not care what you call a box, as long as you follow a few rules. People do care. A program is read many more
    times than it is written, mostly by you in three weeks' time, so the name is the best documentation you will ever write.'''),
    UL('Use letters, digits and underscores; no spaces; do not start with a digit (`2fast` is an error).',
       'Names are **case sensitive**: `energy`, `Energy` and `ENERGY` are three different boxes. This is a classic source of bugs.',
       'Python programmers write `snake_case` (words joined by underscores, `max_energy`); JavaScript programmers write `camelCase` (`maxEnergy`). The language does not force it; everyone expects it.',
       'Avoid words the language already uses (`print`, `class`, `for`, `if`), because shadowing them causes confusing errors.'),
    TABLE(['Poor', 'Better', 'Why'], [
        ['`x`', '`energy`', 'says what it holds'],
        ['`e2`', '`energy_after_trip`', 'says which energy, and when'],
        ['`temp`', '`distance_km`', 'includes the unit, which stops mix-ups'],
        ['`flag`', '`has_parcel`', 'a yes/no box should read like a yes/no question'],
        ['`data1`, `data2`', '`start`, `goal`', 'numbered names hide what each is for'],
    ], 'Names that explain themselves'),

    H2('Bit remembers', 'bit'),
    P('''Bit can tell you how much energy it has: `battery_level()` in Python, `batteryLevel()` in JavaScript, and it can speak with `say(...)`.
    Both of these are used in the missions below. A `say` shows text, so numbers have to be turned into text first, and that is
    exactly what an f-string or a template literal is for.'''),
    BITGRID('code-2-report', 'Mission 1: report in',
            'Bit must report its energy. Store the battery level in a box called `energy`, then make Bit say exactly `Energy: 20`.',
            '''
            #####
            #>..#
            #####
            ''', {'says': ['Energy: 20']},
            '# Ask Bit for its battery level and keep the answer in a box.\n', '// Ask Bit for its battery level and keep the answer in a box.\n',
            'energy = battery_level()\nsay(f"Energy: {energy}")', 'const energy = batteryLevel();\nsay(`Energy: ${energy}`);',
            hint='Two lines: one to store `battery_level()` (or `batteryLevel()`) in a box, one to say the sentence with the box inside it.',
            tools=['say', 'battery']),
    BITGRID('code-2-cost', 'Mission 2: the price of a trip',
            'Walk Bit to the goal pad, then make Bit say how much energy is left, in the form `Energy left: 6`. Bit starts with 10.',
            '''
            ######
            #>...G
            ######
            ''', {'at': 'G', 'says': ['Energy left: 6']},
            '', '',
            'move()\nmove()\nmove()\nmove()\nleft = battery_level()\nsay(f"Energy left: {left}")',
            'move();\nmove();\nmove();\nmove();\nconst left = batteryLevel();\nsay(`Energy left: ${left}`);',
            hint='Each move costs one energy and the corridor is four squares long, so Bit has 6 left. Ask Bit with the battery command *after* the moves, not before.',
            tools=['move', 'say', 'battery'], energy=10),
    BITGRID('code-2-used', 'Mission 3: how much did that cost?',
            'Bit must work out the cost of its own trip. Remember the energy at the start in one box, walk to the goal, then say how much was used, as `Used: 4`. This is the kind of job a variable is for: a value from *before* has to survive until *after*.',
            '''
            ######
            #>...G
            ######
            ''', {'at': 'G', 'says': ['Used: 4']},
            '', '',
            'start = battery_level()\nmove()\nmove()\nmove()\nmove()\nused = start - battery_level()\nsay(f"Used: {used}")',
            'const start = batteryLevel();\nmove();\nmove();\nmove();\nmove();\nconst used = start - batteryLevel();\nsay(`Used: ${used}`);',
            hint='Ask for the battery level *before* the first move and keep it in `start`. After the last move, subtract the new level from `start`.',
            tools=['move', 'say', 'battery']),

    CALLOUT('gotcha', 'Python refuses; JavaScript guesses', '''What should `"5" + 1` do: add, or join? Python says it does not know and stops with a **TypeError**. JavaScript guesses
    and gives the text `"51"`. Neither is wrong, but the difference catches people who learn one language and move to the other. The safe habit in both is to **convert on purpose**
    (`int("5")` in Python, `Number("5")` in JavaScript) and to keep numbers and text apart.'''),
    TRY('Convert on purpose',
        '''
        text = "5"
        number = int(text) + 1
        print(number)
        print(text + "1")
        ''',
        '''
        const text = "5";
        const number = Number(text) + 1;
        console.log(number);
        console.log(text + "1");
        '''),
    P('''The first `print` adds, because the text was turned into a number first. The second joins, because both are text. In both
    languages, `+` on two pieces of text means "stick them together".'''),

    H2('Practice', 'practice'),
    EX('code-2-ex-swap', 'Swap two boxes', 'py',
       'The program below has `a` holding 3 and `b` holding 8. Change it so the two boxes swap contents, then print `a` and `b` on separate lines (so the output is `8` then `3`). Use a third box so neither value is lost.',
       'a = 3\nb = 8\nspare = a\na = b\nb = spare\nprint(a)\nprint(b)',
       hints=['If you write `a = b` first, the old value of `a` is gone for good. Park it in a third box before you overwrite it.'],
       why='Each assignment destroys the old value in that box, so to swap you have to save one of them first. The same pattern shows up inside sorting algorithms.',
       starter='a = 3\nb = 8\n# swap them, then print a and b\n',
       check='assert out.strip() == "8\\n3", "After swapping, print 8 and then 3."'),
    EX('code-2-ex-sentence', 'Build a sentence', 'js',
       'The program has two boxes, `robot` and `energy`. Print exactly `Bit has 12 energy` using a template literal that uses both boxes, not typed-in text.',
       'const robot = "Bit";\nconst energy = 12;\nconsole.log(`${robot} has ${energy} energy`);',
       hints=['Backticks, and `${...}` around each box name.'],
       why='Putting the boxes inside the sentence means the sentence follows them: change `energy` and the message changes with it.',
       starter='const robot = "Bit";\nconst energy = 12;\n// print the sentence here\n',
       check='assert(out.trim() === "Bit has 12 energy", "Print exactly: Bit has 12 energy");'),
    EX('code-2-ex-trace', 'Track the boxes', 'think',
       ['Work out by hand, without running anything, what `a` and `b` hold at the end:',
        {'t': 'code', 'lang': 'text', 'attrs': {}, 'code': 'a = 4\nb = a * 2\na = a + b\nb = b - 3', 'line': 1},
        'Draw a small table with a column for each box and a row after each line. Then check it in the stepper if you like.'],
       'After line 1: a=4. Line 2: b=8. Line 3: a=12 (4 + 8). Line 4: b=5 (8 - 3). Final: a is 12 and b is 5.',
       hints=['Do one line at a time and write both boxes down after every line, even the one that did not change.'],
       why='This is what the stepper does for you. Doing it on paper first, on a short program, is the quickest way to learn to read code.'),
    CHECK('code-2-ch-checkpoint', 'Variables checkpoint',
          Q('What does `energy = energy - 1` do?',
            [('Takes the value out of the box, subtracts one and puts the result back in the same box', True), ('States that energy equals itself minus one', False), ('Makes a second box called energy', False), ('Is an error, because a box cannot depend on itself', False)],
            '`=` is an instruction, not a claim: work out the right-hand side first, then store it in the box on the left.'),
          Q('Which of these is a piece of text, not a number?',
            [('`"20"`', True), ('`20`', False), ('`2.5`', False), ('`-3`', False)],
            'Quotation marks make it text, even if the characters are digits. Text and numbers behave differently.'),
          Q('Which is the best name for a box that holds the number of parcels Bit is carrying?',
            [('`parcels_carried`', True), ('`x`', False), ('`p`', False), ('`data1`', False)],
            'A good name says what the value means. `x` and `p` say nothing, and numbered names hide the purpose.'),
          Q('You write `Energy = 5` and later print `energy`. What happens?',
            [('An error: names are case sensitive, so `energy` was never made', True), ('It prints 5', False), ('It prints 0', False), ('It prints nothing', False)],
            '`Energy` and `energy` are different names. Spelling the capital letters wrongly is one of the most common bugs for new programmers.')),

    H2('Where this goes next', 'next'),
    P('''Boxes can hold values, but so far every instruction runs no matter what. [The next chapter](#code-decide) teaches Bit to look at what
    is in a box (or in front of it) and **decide**. You will see variables again in the shell, where `export PATH=...` and `name=Bit`
    are the same idea ([Shell Scripting](#scripting)), and in [Python Basics](#py-basics), which goes deeper into numbers, text and
    their quirks.'''),
]

terms = [
    ('variable', 'a named box in the program that holds a value, which can change'),
    ('assignment', 'putting a value into a variable with =; work out the right side, then store it'),
    ('value', 'a piece of data such as 20, "Bit" or True'),
    ('type', 'the kind of a value: number, text, true/false and so on; it decides what you can do with it'),
    ('integer', 'a whole number'),
    ('float', 'a decimal number'),
    ('boolean', 'a value that is either true or false'),
    ('None / null', 'the value that means "nothing here"; None in Python, null in JavaScript'),
    ('expression', 'something the computer can work out to a value, such as energy - 1'),
    ('f-string', 'Python text with an f in front, where {name} is replaced by the value of name'),
    ('template literal', 'JavaScript text in backticks, where ${name} is replaced by the value of name'),
    ('snake_case', 'naming style with words joined by underscores; the Python habit'),
    ('camelCase', 'naming style with each new word capitalised; the JavaScript habit'),
]

CHAPTER = chapter('code-vars', 'Boxes with Labels: Variables and Values',
                  'Giving a program a memory: variables, the kinds of value, arithmetic, joining text and choosing good names',
                  'code-hello', 45,
                  ['Store a value in a named box and change it later',
                   'Tell numbers, text and true/false apart, and say why the kind matters',
                   'Do arithmetic and build sentences from the values in boxes',
                   'Choose clear names for boxes in the style each language expects',
                   'Read a program by tracking what each box holds after every line'],
                  blocks, terms, level='basics', part='code', file='05.02-code-vars.gm')
