from lib import *

blocks = [
    P('''Bit's next job is a corridor forty squares long. With what you know so far, that is forty lines that all say `move()`. Then
    someone builds a longer corridor and you have to write forty-one. There has to be a better way, and there is: tell the computer to
    **do the same thing again**. A computer never gets bored and never miscounts, so repeating is the thing it does best. This
    chapter is about **loops**, the second great idea in code after decisions.'''),

    H2('Doing things again and again', 'why'),
    CALLOUT('why', 'Why loops exist', '''Almost every useful program repeats something. Copying a folder repeats "copy one file". A search engine repeats "compare this page with the question"
    millions of times. A game repeats "draw one frame" sixty times a second. Writing a loop instead of copying lines does three things: the program is **shorter**, it **adapts** (change a
    single number and the repeat count changes), and it has **fewer places for a typo to hide**. Loops are also where computers get their speed: a loop that runs a billion times takes a few seconds.'''),
    P('''There are two kinds of loop, and the difference is what decides when to stop. A **`for` loop** says "do this a known number of times,
    or once for each item". A **`while` loop** says "keep doing this for as long as something is true". You need both.'''),

    H2('Repeat a known number of times: for', 'for'),
    P('''Step through this loop. The line with `for` is run again before every round: it hands the box `lap` its next value and checks whether any are left.
    When none are, the loop is over and the program carries on with the line after the block.'''),
    STEP('Repeat three times',
         '''
         for lap in range(3):
             print("Lap", lap + 1)
         print("Finished")
         ''',
         '''
         for (let lap = 0; lap < 3; lap++) {
           console.log("Lap", lap + 1);
         }
         console.log("Finished");
         ''',
         {1: LOOP('Start the loop. The box `lap` is created and gets the first value, {lap}.', 'Another round: `lap` gets the next value, {lap}.',
                  'No more values, so the loop is over. The arrow leaves the block.', 2),
          2: 'The block runs once per value. `lap` is {lap}, so this shows lap number {lap} plus one.',
          3: 'Back to ordinary top-to-bottom running.'}),
    P('''Look at the first number: `lap` started at **0**, not 1. Computers count from zero, which is why `range(3)` gives 0, 1, 2 (three values) and why the
    program prints `lap + 1`. You will meet this again with lists, and it is the cause of the most famous bug in programming (the "off-by-one" error, see [chapter 8](#code-debug)).'''),
    ANAT('Reading a Python for loop', [('for', 'start a loop that goes once for each value'), ('lap', 'the box that receives each value in turn'),
                                       ('in range(3)', 'the values to go through: 0, 1, 2. `range(n)` counts from 0 up to, but not including, n'), (':', 'the colon opens the block; the indented lines below are what repeats')]),
    ANAT('Reading a JavaScript for loop', [('for', 'start a loop'), ('(let lap = 0;', 'setup: runs once before the first round'), ('lap < 3;', 'the question, asked before every round; the loop stops when the answer is no'),
                                           ('lap++)', 'the update, run after every round: add 1 to `lap`'), ('{ ... }', 'the block of instructions that repeats')]),
    TRY('Change how many',
        '''
        for lap in range(3):
            print("Lap", lap + 1)
        print("Finished")
        ''',
        '''
        for (let lap = 0; lap < 3; lap++) {
          console.log("Lap", lap + 1);
        }
        console.log("Finished");
        '''),
    P('''Change the 3 to 5, then to 0. What do you expect, and what happens? A loop that runs zero times is legal and, very often, exactly right.'''),

    H2('Repeat while something is true: while', 'while'),
    P('''Sometimes you do not know in advance how many rounds are needed. Bit should keep moving *while the way ahead is clear*. A `while` loop asks its question
    **before every round**, runs the block if the answer is yes, and goes back to ask again. The loop ends when the answer is finally no.'''),
    STEP('Counting down',
         '''
         count = 3
         while count > 0:
             print(count)
             count -= 1
         print("Go!")
         ''',
         '''
         let count = 3;
         while (count > 0) {
           console.log(count);
           count -= 1;
         }
         console.log("Go!");
         ''',
         {1: 'Start with {count} in the box.',
          2: LOOP('Is {count} above 0? Yes, so run the block.', 'Is {count} above 0? Yes, so run the block again.', 'Is {count} above 0? No. The loop is over, and the block is skipped.', 3),
          3: 'Show the number.', 4: 'Count down by one. **This line is what eventually makes the answer no.**', 5: 'Blast off.'}),
    CALLOUT('gotcha', 'The endless loop', '''A `while` loop ends only when its question stops being yes. If nothing inside the block ever changes the answer (you forgot the `count -= 1`) the loop runs **forever**, and the program
    appears to hang. Every `while` needs something in the block that moves toward the end. In this book's runnable examples a program that runs for more than a few seconds is stopped for you.
    In a real program press `Ctrl+C` in the terminal to break out. Treat a hang as a loop that cannot finish, and check what changes inside it.'''),
    TABLE(['', '`for`', '`while`'], [
        ['Use it when', 'you know how many rounds, or you have a collection to go through', 'you repeat until something *happens*'],
        ['Example', '"3 laps", "each file in this folder"', '"until the way ahead is blocked", "until the user types quit"'],
        ['Who changes the counter?', 'the loop does it for you', 'you do, inside the block'],
        ['Risk', 'off-by-one (one too many or too few)', 'never ending'],
    ], 'Choosing a loop'),

    H2('Adding things up', 'total'),
    P('''Loops and boxes work together in a pattern you will use for the rest of your programming life: the **accumulator**. Make a box, start it at a neutral value (0 for a sum),
    and in every round update it. When the loop ends, the box holds the answer. Watch both `n` and `total` change.'''),
    STEP('Add the numbers 1 to 5',
         '''
         total = 0
         for n in range(1, 6):
             total += n
         print("Total:", total)
         ''',
         '''
         let total = 0;
         for (let n = 1; n <= 5; n++) {
           total += n;
         }
         console.log("Total:", total);
         ''',
         {1: 'The running total starts at {total}.',
          2: LOOP('`n` takes its first value, {n}. (`range(1, 6)` starts at 1 and stops *before* 6.)', 'Next value: `n` is {n}.', 'No numbers left, so the loop ends.', 3),
          3: 'Add `n` to the total. The total is now {total}.', 4: 'The loop is finished and the box holds the answer.'}),
    CALLOUT('why', 'The same pattern, different jobs', '''Start with a neutral value, update it every round. For a **sum** the box starts at 0 and you add. For a **count** it starts at 0 and you add 1 when something matches.
    For **joining text** it starts as `""` and you add words. For the **biggest** so far it starts as the first value and you replace it when a larger one turns up. The loop and the box
    are the machine; the update line says what you are measuring.'''),
    TRY('Your turn: add something up',
        '''
        total = 0
        for n in range(1, 11):
            total += n * n
        print("Sum of squares:", total)
        ''',
        '''
        let total = 0;
        for (let n = 1; n <= 10; n++) {
          total += n * n;
        }
        console.log("Sum of squares:", total);
        '''),

    H2('Loops inside loops', 'nested'),
    P('''The block of a loop can contain another loop. The inner loop runs **completely** every time the outer loop goes round once. Two rows of three is six cells, and the way to see why is to step through it.'''),
    STEP('A rectangle of hashes',
         '''
         for row in range(2):
             line = ""
             for col in range(3):
                 line += "#"
             print(line)
         ''',
         '''
         for (let row = 0; row < 2; row++) {
           let line = "";
           for (let col = 0; col < 3; col++) {
             line += "#";
           }
           console.log(line);
         }
         ''',
         {1: LOOP('The outer loop starts: this is row {row}.', 'The outer loop goes round again: row {row}.', 'Both rows are done. The program ends.', 2),
          2: 'A fresh, empty line for this row.',
          3: LOOP('The inner loop starts: column {col}.', 'Next column: {col}.', 'The inner loop ran out of columns, so this row is complete.', 4),
          4: 'Add one `#` to the row being built.', 5: 'The row is finished: show it. Then back up to the outer loop.'}),
    P('''The inner loop ran three times for each of the two rows, so the `#` line ran 2 × 3 = 6 times. That multiplication is why nested loops get expensive quickly, and
    why the people who build search engines worry about them.'''),

    H2('Stopping early: break', 'break'),
    P('''You do not always want a loop to run to the end. If you are searching for something and you have found it, carry on looking is waste. `break` leaves the loop at once and
    carries on with the line after it (`continue` is the cousin that skips to the next round instead).'''),
    STEP('Stop when you find it',
         '''
         for n in range(1, 10):
             if n * n > 20:
                 print("First square above 20:", n * n)
                 break
         ''',
         '''
         for (let n = 1; n < 10; n++) {
           if (n * n > 20) {
             console.log("First square above 20:", n * n);
             break;
           }
         }
         ''',
         {1: LOOP('Start with {n}.', 'Next number: {n}.', 'Out of numbers.', 2),
          2: 'Is {n} squared bigger than 20? Not yet for the small numbers. Watch for the one where the answer turns to yes.',
          3: 'Found it. Show the square.', 4: '`break` ends the loop immediately, even though the numbers up to 9 were not all used.'}),

    H2('Bit runs loops', 'bit'),
    P('''Time to take the forty-square corridor off Bit's hands. Each mission has several maps, and each has a different length, so no solution that counts squares will work on all of them.'''),
    BITGRID('code-4-corridor', 'Mission 1: any corridor',
            'Walk Bit to the goal pad at the end of the corridor. The corridor is a different length on each map, so keep moving *while the way ahead is clear*.',
            '''
            #######
            #>...G#
            #######
            ''', {'at': 'G'},
            '# Use a loop so one program works for every length.\n', '// Use a loop so one program works for every length.\n',
            'while front_is_clear():\n    move()', 'while (frontIsClear()) {\n  move();\n}',
            hint='`while front_is_clear():` and, indented underneath, `move()`. The loop keeps going until the wall is in front of Bit.',
            tools=['move', 'front'],
            more=['''
                  ###########
                  #>.......G#
                  ###########
                  ''', '''
                  ####
                  #>G#
                  ####
                  ''']),
    BITGRID('code-4-lap', 'Mission 2: one lap of the ring',
            'There is a battery in three corners of the ring. Walk around it and collect all three. A side of the ring is three moves, then Bit picks up the battery and turns right. Your program may use **at most 8 lines**: typing it all out would take 15, so you have to repeat.',
            '''
            ######
            #>..B#
            #.##.#
            #.##.#
            #B..B#
            ######
            ''', {'collect': 'all', 'maxLines': 8},
            '# Repeat "three moves, take, turn right" three times.\n', '// Repeat "three moves, take, turn right" three times.\n',
            'for side in range(3):\n    for step in range(3):\n        move()\n    take()\n    turn_right()',
            'for (let side = 0; side < 3; side++) {\n  for (let step = 0; step < 3; step++) {\n    move();\n  }\n  take();\n  turnRight();\n}',
            hint='An outer loop for the three sides, with an inner loop for the three moves along a side. After the inner loop: `take()` then `turn_right()`.',
            tools=['move', 'turn', 'take']),
    BITGRID('code-4-trail', 'Mission 3: follow the battery trail',
            'Batteries lie along the corridor in different places on each map. Collect every one. Check for a battery *after* each move. (`take()` on an empty square crashes Bit.)',
            '''
            #########
            #>B.B.B.#
            #########
            ''', {'collect': 'all'},
            '', '',
            'while front_is_clear():\n    move()\n    if on_battery():\n        take()',
            'while (frontIsClear()) {\n  move();\n  if (onBattery()) {\n    take();\n  }\n}',
            hint='Loop while the front is clear. In the loop: move, then `if on_battery():` take it. Bit never starts on a battery, so checking after each move catches every one, including the one in the last square.',
            tools=['move', 'front', 'onb', 'take'],
            more=['''
                  ##########
                  #>.BB..B.#
                  ##########
                  ''', '''
                  #######
                  #>BBBB#
                  #######
                  ''']),
    CALLOUT('gotcha', 'Common mistakes with loops', '''Off by one: `range(3)` gives 3 values *starting at 0*, so it ends at 2. A `while` loop whose block never changes the thing it asks about, so it never ends. Changing a loop's own counter inside the block when you did not mean to.
    Putting a line inside the block that should be after the loop (check the indentation, or the braces). Forgetting that the loop's variable still exists after the loop ends, holding the last value it had.'''),

    H2('Practice', 'practice'),
    EX('code-4-ex-countdown', 'Countdown', 'py',
       'Use a `while` loop to print `5`, `4`, `3`, `2`, `1` on separate lines and then `Go!`. The box `count` already holds 5.',
       'count = 5\nwhile count > 0:\n    print(count)\n    count -= 1\nprint("Go!")',
       hints=['The loop asks "is count above 0?". Do not forget to change `count` inside the block.'],
       why='The loop ends because the block changes the thing the loop asks about. Take out `count -= 1` and the loop never finishes, which is the endless loop from this chapter.',
       starter='count = 5\n# loop here\n',
       check='assert out.strip() == "5\\n4\\n3\\n2\\n1\\nGo!", "Print 5, 4, 3, 2, 1 and then Go! on separate lines."'),
    EX('code-4-ex-table', 'A times table', 'py',
       'Print the three times table from 3 x 1 to 3 x 5, one line each, in exactly this form: `3 x 1 = 3`, `3 x 2 = 6`, and so on, ending with `3 x 5 = 15`. Use a `for` loop and an f-string.',
       'for n in range(1, 6):\n    print(f"3 x {n} = {3 * n}")',
       hints=['`range(1, 6)` gives 1 to 5. Inside the f-string you can write `{3 * n}`.'],
       why='The loop variable is an ordinary box, so you can use it in sums and in text. Changing the 3 to a variable would make it a table for any number.',
       starter='# print the table here\n',
       check='assert out.strip() == "3 x 1 = 3\\n3 x 2 = 6\\n3 x 3 = 9\\n3 x 4 = 12\\n3 x 5 = 15", "Print 3 x 1 = 3 up to 3 x 5 = 15, one per line."'),
    EX('code-4-ex-sum', 'Add 1 to 100', 'js',
       'Use a loop to add up the whole numbers from 1 to 100 and print the total. (Everyone who learns loops writes this one. There is a story about a schoolboy who did it in his head.)',
       'let total = 0;\nfor (let n = 1; n <= 100; n++) {\n  total += n;\n}\nconsole.log(total);',
       hints=['An accumulator: `total` starts at 0 and gets `n` added every round. The condition is `n <= 100`.'],
       why='The total is 5050. The loop is the accumulator pattern with a bigger range. Computers do this addition faster than you can read the program.',
       starter='// add up 1 to 100 and print the total\n',
       check='assert(out.trim() === "5050", "Print 5050.");'),
    EX('code-4-ex-trace', 'How many times?', 'think',
       ['Without running anything, say how many times each line runs:',
        {'t': 'code', 'lang': 'text', 'attrs': {}, 'code': 'for a in range(4):\n    for b in range(5):\n        print("hi")\n\nx = 1\nwhile x < 100:\n    x = x * 2', 'line': 1},
        'How many times does `print("hi")` run? How many times does `x = x * 2` run, and what is `x` at the end?'],
       'The inner loop runs 5 times for each of the 4 outer rounds, so "hi" is printed 4 x 5 = 20 times. The `while` loop doubles x: 1 to 2, 4, 8, 16, 32, 64, 128. That is 7 doublings, and x ends at 128, because 64 is still below 100 so it runs once more.',
       hints=['For the second one, write the value of x after each round until the condition fails.'],
       why='Counting rounds by hand is the way to understand any loop. The doubling loop is also the shape of a lot of real behaviour: halving a search area, growing a cache, and so on take a number of rounds that grows slowly.'),
    CHECK('code-4-ch-checkpoint', 'Loops checkpoint',
          Q('How many values does `range(4)` produce, and what are they?',
            [('Four: 0, 1, 2, 3', True), ('Four: 1, 2, 3, 4', False), ('Five: 0, 1, 2, 3, 4', False), ('Three: 1, 2, 3', False)],
            'Counting starts at zero and stops *before* the number you give. `range(n)` always produces n values.'),
          Q('When should you choose `while` over `for`?',
            [('When you repeat until something happens and do not know how many rounds that takes', True), ('Whenever you want the program to run faster', False), ('When you have more than ten rounds', False), ('Never: `for` can always do it better', False)],
            '`for` suits a known count or a collection; `while` suits "keep going until". Bit walking until the wall is in front of it is the classic `while`.'),
          Q('Your program seems to freeze. Which is the most likely cause?',
            [('A `while` loop whose block never changes what the loop asks about', True), ('The computer is too slow', False), ('Python does not support loops', False), ('You used too many boxes', False)],
            'An endless loop looks like a hang. Check what inside the loop moves toward its end.'),
          Q('A `for` loop runs 3 times and contains another `for` loop that runs 4 times. How many times does the inner block run in total?',
            [('12', True), ('7', False), ('4', False), ('3', False)],
            'The inner loop runs completely for every round of the outer loop: 3 x 4 = 12.')),

    H2('Where this goes next', 'next'),
    P('''Loops will show up in everything from here. They are how you go through the lines of a file, the packets in a capture and the devices on a network, and the
    [Streams, Redirection and Pipes](#pipes) chapter and [Shell Scripting](#scripting) have `for` and `while` loops that read exactly like these. In the [next chapter](#code-funcs),
    Bit learns to *name* a sequence of instructions, so a lap around the ring becomes a single word. Before long you will be reading a loop and a decision together: that is where most
    real programs live. If a particular loop in the Python part (`enumerate`, `zip`, comprehensions) looks odd, look at [Python Flow](#py-flow), which takes everything here further.'''),
]

terms = [
    ('loop', 'code that repeats a block of instructions'),
    ('for loop', 'a loop that runs once for each value in a range or collection'),
    ('while loop', 'a loop that repeats as long as its condition is true'),
    ('iteration', 'one round of a loop'),
    ('counter', 'a variable that a loop adds to as it goes'),
    ('accumulator', 'a variable that a loop updates each round to build up a result such as a sum'),
    ('nested loop', 'a loop inside another loop'),
    ('infinite loop', 'a loop that never ends because its condition never becomes false'),
    ('break', 'ends a loop immediately'),
    ('off-by-one error', 'a bug where a loop runs one time too many or too few'),
]

CHAPTER = chapter('code-loops', 'Loops: Doing Something Again and Again',
                  'Repeating instructions with for and while, counting and adding up, nesting loops, stopping early, and making one short program cover any size of corridor',
                  'code-decide', 50,
                  ['Repeat instructions a fixed number of times with for',
                   'Repeat until a condition changes with while, and avoid endless loops',
                   'Use a counter and an accumulator to total, count and build results',
                   'Nest loops and say how many times the inner block runs',
                   'Stop early with break and write one program that covers any corridor length'],
                  blocks, terms, level='basics', part='code', file='05.04-code-loops.gm')
