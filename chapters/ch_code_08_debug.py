from lib import *

blocks = [
    P('''Every programmer, from a first-week beginner to the person who wrote the language, spends a large part of their time looking at code that does not do what they expected. The word *bug* for a
    flaw is older than computers, and finding and fixing bugs is called **debugging**. It is not a sign of failure. It is the job. The good news is that debugging is a skill with a method, and
    Bit's world (where a mistake makes a robot roll into a wall) is a gentle place to learn it.'''),

    H2('Why it is never "the computer is wrong"', 'why'),
    P('''The computer follows your instructions exactly. If the result is wrong, then either the instructions did not say what you meant, or you were wrong about what the instructions *do*. Either way the fault is
    in your understanding, which is encouraging, because that is the part you can fix. The detective work is finding the first place where what the program is really doing differs from what you thought.'''),
    CALLOUT('why', 'Why learn debugging early', '''Experienced programmers are not people who write code without mistakes. They are the people who find mistakes quickly. A method (reproduce it, shrink it, guess, test, fix) turns hours of
    staring into minutes. And because a program that is hard to debug is a program that is hard to change, the habits in this chapter also make you write simpler code in the first place.'''),

    H2('Three kinds of problem', 'kinds'),
    TABLE(['Kind', 'What happens', 'Example', 'How you find out'], [
        ['**Syntax error**', 'the program will not even start', 'a missing bracket, quotation mark or colon', 'the language refuses and points at (or just after) the spot'],
        ['**Runtime error**', 'it starts, then crashes at one line', 'using a name that does not exist, a list index past the end', 'an error message with a line number'],
        ['**Logic bug**', 'it runs to the end and gives the **wrong answer**', 'adding when you meant to multiply; a loop one round short', 'nothing tells you: you have to notice'],
    ], 'Where things go wrong'),
    P('''Syntax errors and runtime errors are the friendly ones, because the computer tells you where. Here is a runtime error. The stepper shows the line it stopped on in red:'''),
    STEP('A runtime error',
         '''
         energy = 10
         print("Energy:", energy)
         print("Left:", enrgy)
         ''',
         '''
         let energy = 10;
         console.log("Energy:", energy);
         console.log("Left:", enrgy);
         ''',
         {1: 'A box called `energy`, spelled correctly.', 2: 'Works: the name exists.',
          3: ['This line uses a name, `enrgy`, with a letter missing. There is no box called that.', '**The program stops here.** The error message says what could not be found. Lines after this one never run.']},
         error_js='ReferenceError: enrgy is not defined',
         allow_error=True),
    P('''A logic bug is the opposite: the program runs perfectly and the answer is wrong. There is no red line. Run this one and watch what happens to `n`. The program is meant to add the numbers 1 to 5.'''),
    STEP('A logic bug: no error, wrong answer',
         '''
         total = 0
         for n in range(1, 5):
             total += n
         print("Sum of 1 to 5:", total)
         ''',
         '''
         let total = 0;
         for (let n = 1; n < 5; n++) {
           total += n;
         }
         console.log("Sum of 1 to 5:", total);
         ''',
         {1: 'The running total starts at zero.',
          2: LOOP('`n` starts at 1.', 'Next: `n` is {n}.', '**The loop is over, and `n` never reached 5.** `range(1, 5)` stops *before* 5.', 3),
          3: 'Add `n` to the total: now {total}.', 4: 'The program prints 10. The right answer is 15. The computer did exactly what it was told; the instructions were one number short.'}),

    H2('Reading an error message', 'read'),
    P('''An error message looks like noise at first, and it is the most useful clue you will ever get. It has a fixed structure, and once you know where to look it takes a few seconds to read. Here is the
    runtime error from above as Python prints it:'''),
    TEXT('''
         Traceback (most recent call last):
           File "bit.py", line 3, in <module>
             print("Left:", enrgy)
         NameError: name 'enrgy' is not defined
         '''),
    ANAT('Anatomy of a Python error', [('Traceback (most recent call last):', 'the header: below is the trail of calls that led here, the most recent last'),
                                       ('File "bit.py", line 3', 'which file and which line: **start looking here**'),
                                       ('print("Left:", enrgy)', 'the line itself, copied from your code'),
                                       ('NameError', 'the **kind** of error'),
                                       ("name 'enrgy' is not defined", 'the explanation, in words')]),
    P('''**Read from the bottom up.** The last line tells you *what* went wrong. The line above it tells you *where*. JavaScript prints the same information in a different order:'''),
    TEXT('''
         ReferenceError: enrgy is not defined
             at bit.js:3:23
         '''),
    TABLE(['Python', 'JavaScript', 'Usually means'], [
        ['`NameError`', '`ReferenceError`', 'a typo, or a name used before it was created'],
        ['`TypeError`', '`TypeError`', 'a value of the wrong kind: adding text to a number (Python), calling something that is not a function'],
        ['`IndexError`', '(gives `undefined`)', 'asking a list for a position past its end'],
        ['`KeyError`', '(gives `undefined`)', 'asking a dictionary for a key that is not there'],
        ['`ZeroDivisionError`', '(gives `Infinity`)', 'dividing by zero'],
        ['`SyntaxError`', '`SyntaxError`', 'a typo in the shape of the code: a missing bracket, quote or colon'],
        ['`IndentationError`', '(none)', 'Python only: lines indented the wrong amount'],
    ], 'The errors you will meet most'),
    CALLOUT('tip', 'Copy the message exactly', '''When you ask anyone for help, including a search engine, paste the **last line of the error** (the kind and the explanation) and the **line it points at**. "It doesn't work" cannot be answered; `NameError: name 'enrgy' is not defined` takes five seconds. Often, writing it
    down is enough to see the problem yourself.'''),

    H2('The off-by-one error', 'offbyone'),
    P('''The logic bug above is the most famous bug in programming, and you will probably write it this week. A fence with five sections needs six posts. A list of five items has indexes 0 to 4. `range(5)` gives 0 to 4, so
    `range(1, 5)` gives only four numbers and stops at 4. Whether to use `<` or `<=`, and whether a count starts at 0 or 1, are *boundary* questions, and boundaries are where bugs live.'''),
    TABLE(['You want', 'Python', 'JavaScript'], [
        ['the numbers 0, 1, 2, 3, 4', '`range(5)`', '`for (let i = 0; i < 5; i++)`'],
        ['the numbers 1, 2, 3, 4, 5', '`range(1, 6)`', '`for (let i = 1; i <= 5; i++)`'],
        ['every index of a list `xs`', '`range(len(xs))`', '`for (let i = 0; i < xs.length; i++)`'],
    ], 'Getting the boundary right'),
    TRY('Fix the boundary',
        '''
        total = 0
        for n in range(1, 5):
            total += n
        print("Sum of 1 to 5:", total)
        ''',
        '''
        let total = 0;
        for (let n = 1; n < 5; n++) {
          total += n;
        }
        console.log("Sum of 1 to 5:", total);
        '''),
    P('''Change it so it prints 15. Then check the **edges** on purpose: what does it print for 1 to 1, and for 1 to 0? A good habit: test the smallest case, the biggest case and the empty case.'''),

    H2('The debugging loop', 'loop'),
    P('''When a program is wrong and you cannot see why, do not stare. Run through the same short loop each time:'''),
    OL('**Reproduce it.** Make it go wrong the same way every time. If you cannot make it fail on demand, you cannot know whether you fixed it.',
       '**Shrink it.** Cut away everything that is not needed to show the problem until a few lines are left. Often the bug becomes obvious while you do this.',
       '**Guess, out loud.** Say what you think is wrong: "I think `total` is not being reset". A specific guess can be tested; "something is broken" cannot.',
       '**Look, do not assume.** Print the values (`print("total is", total)`) or step through the program and check the boxes at the point where you think it goes wrong. The first place the box differs from what you expected is where the bug is, or just before it.',
       '**Fix one thing, then run it again.** Change one thing at a time, so you know which change worked, and re-run your reproduction to prove it is gone.'),
    P('''This is the stepper's whole purpose. It is a "print everything, at every step" machine. Here is a bug: this function should give the energy a trip costs when each square costs `rate` energy. The call
    expects 10. Step through and look at what it hands back.'''),
    STEP('Bug hunt: what does it hand back?',
         '''
         def cost(distance, rate):
             return distance + rate

         print(cost(5, 2))
         ''',
         '''
         function cost(distance, rate) {
           return distance + rate;
         }

         console.log(cost(5, 2));
         ''',
         {1: 'Define the function.', 4: 'We expect this to print 10: five squares at two energy each. Let us see.',
          2: 'Inside the call: `distance` is {distance} and `rate` is {rate}. Both are right, so the inputs are fine. Now the line that works out the answer.',
          ('ret', 2): '**Hands back 7.** Five plus two. The inputs were correct and the output is wrong, so the bug is in this one line: it adds when it should multiply.',
          5: 'The wrong answer reaches the screen: the bug was found without guessing.'}),
    CALLOUT('deep', 'Rubber duck debugging', '''Explaining your code, line by line and out loud, to a rubber duck (or a patient friend, or an empty chair) finds more bugs than you would expect. To explain what a line does you have to read what it really says, instead of what you meant it to say.
    The two are different exactly where the bug is.'''),

    H2('Tests: make the computer check', 'tests'),
    P('''Checking by eye is slow, and you forget to do it. A **test** is a tiny program that checks your function for you: give it an input, say what the answer *should* be, and complain if it is not.
    The simplest test is `assert`: it does nothing when the statement is true and stops with an error when it is false. JavaScript's equivalent in the browser is `console.assert`, which reports a failure without stopping.'''),
    TRY('Two tests and a function',
        '''
        def cost(distance, rate):
            return distance * rate

        assert cost(5, 2) == 10, "cost(5, 2) should be 10"
        assert cost(0, 9) == 0, "a trip of zero squares costs nothing"
        print("all tests passed")
        ''',
        '''
        function cost(distance, rate) {
          return distance * rate;
        }

        console.assert(cost(5, 2) === 10, "cost(5, 2) should be 10");
        console.assert(cost(0, 9) === 0, "a trip of zero squares costs nothing");
        console.log("all tests passed");
        '''),
    P('''Change `*` to `+` and run it again: the first test fails, and the message says which. Every exercise in this book is checked this way: when you press **Check**, the page runs your code, then a handful of `assert`s that say what correct looks like.
    Writing the test **before** the function is a well-known habit called test-driven development, covered in [Errors, Debugging and Testing](#py-errors).'''),
    CALLOUT('why', 'Why tests matter', '''A test is an executable example of what "correct" means. It catches the bug the moment you introduce it instead of next month, and it lets you change code without being afraid, because the tests tell you if you broke something.
    It is also a lovely way to think: if you cannot say what the right answer should be, you are not ready to write the function yet.'''),

    H2('Bit hunts bugs', 'bit'),
    P('''These programs are all broken. Your job is *not* to write a program from scratch: it is to read it, work out what it really does (the stepper in your head), find the first place it differs from what the mission needs, and change as little as possible.'''),
    BITGRID('code-8-wrong-turn', 'Bug 1: the wrong turn',
            'Bit should follow the corridor round the corner to the goal pad, but it crashes. Predict where Bit ends up before you run it, then fix the one word that is wrong.',
            '''
            #####
            #>..#
            ###.#
            ###G#
            #####
            ''', {'at': 'G'},
            'move()\nmove()\nturn_left()\nmove()\nmove()\n', 'move();\nmove();\nturnLeft();\nmove();\nmove();\n',
            'move()\nmove()\nturn_right()\nmove()\nmove()', 'move();\nmove();\nturnRight();\nmove();\nmove();',
            hint='After two moves Bit is at the corner and faces east. The corridor continues *south*. Which turn takes a robot facing east to face south?', tools=['move', 'turn']),
    BITGRID('code-8-one-short', 'Bug 2: one square short',
            'Bit should walk five squares to the goal pad. The loop looks right and Bit stops early. Where does the off-by-one error hide?',
            '''
            #######
            #>....G
            #######
            ''', {'at': 'G'},
            'for i in range(1, 5):\n    move()\n', 'for (let i = 1; i < 5; i++) {\n  move();\n}\n',
            'for i in range(5):\n    move()', 'for (let i = 0; i < 5; i++) {\n  move();\n}',
            hint='How many times does the loop body run? Count the values `i` takes. Start from zero or finish one later.', tools=['move']),
    BITGRID('code-8-wrong-answer', 'Bug 3: the wrong answer',
            'Bit should report the cost of a trip of 5 squares at 2 energy each: `Cost: 10`. The program runs and says the wrong thing. Find the bug with no help from an error message.',
            '''
            ####
            #>.#
            ####
            ''', {'says': ['Cost: 10']},
            'def cost(distance, rate):\n    return distance + rate\n\nsay(f"Cost: {cost(5, 2)}")\n',
            'function cost(distance, rate) {\n  return distance + rate;\n}\n\nsay(`Cost: ${cost(5, 2)}`);\n',
            'def cost(distance, rate):\n    return distance * rate\n\nsay(f"Cost: {cost(5, 2)}")',
            'function cost(distance, rate) {\n  return distance * rate;\n}\n\nsay(`Cost: ${cost(5, 2)}`);',
            hint='Read what Bit says, then read the function. Which operator would give 10?', tools=['say']),

    H2('Practice', 'practice'),
    EX('code-8-ex-largest', 'Fix the largest', 'py',
       'This function should return the largest number in a list, but it gives the wrong answer for some lists. Find out which, and fix it.',
       'def largest(numbers):\n    best = numbers[0]\n    for n in numbers:\n        if n > best:\n            best = n\n    return best',
       hints=['Try `largest([-5, -2, -9])`. What does it return, and what should it? What is the starting champion, and is it a fair one?'],
       why='Starting `best` at 0 assumes there is a number at least as big as 0. For a list of negatives, nothing ever beats it. Starting with the first item makes the champion a real member of the list. The bug lives at the **edge** of what the code assumed.',
       starter='def largest(numbers):\n    best = 0\n    for n in numbers:\n        if n > best:\n            best = n\n    return best\n',
       check='assert largest([3, 9, 2]) == 9, "largest([3, 9, 2]) should be 9"\nassert largest([-5, -2, -9]) == -2, "largest([-5, -2, -9]) should be -2"\nassert largest([7]) == 7, "a list of one"'),
    EX('code-8-ex-one-to', 'Fix the range', 'js',
       'This function should return an array of the numbers from 1 up to and including `n`, but it stops one short. Fix it with the smallest change.',
       'function oneTo(n) {\n  const result = [];\n  for (let i = 1; i <= n; i++) {\n    result.push(i);\n  }\n  return result;\n}',
       hints=['Is the last number `n` included? Look at the loop condition.'],
       why='`<` stops before `n`; `<=` includes it. Off-by-one errors are fixed by deciding which end of the range is included and writing the condition to match.',
       starter='function oneTo(n) {\n  const result = [];\n  for (let i = 1; i < n; i++) {\n    result.push(i);\n  }\n  return result;\n}\n',
       check='assert(typeof oneTo === "function", "Keep the function named oneTo.");\nassert(JSON.stringify(oneTo(3)) === "[1,2,3]", "oneTo(3) should be [1, 2, 3]. Got " + JSON.stringify(oneTo(3)));\nassert(JSON.stringify(oneTo(1)) === "[1]", "oneTo(1) should be [1]");\nassert(JSON.stringify(oneTo(0)) === "[]", "oneTo(0) should be empty");'),
    EX('code-8-ex-classify', 'What kind of problem?', 'think',
       ['Say whether each is a syntax error, a runtime error or a logic bug:',
        '1. The program will not start: `SyntaxError: unexpected EOF` (it ended while something was still open).\n2. It starts and stops with `IndexError: list index out of range` on line 12.\n3. It prints a total of 90 when the right answer is 100, and no error appears.\n4. `NameError: name \'totl\' is not defined`.'],
       '1. Syntax error: a bracket or quotation mark was never closed. 2. Runtime error: line 12 asks a list for a position it does not have (check the length and the index). 3. Logic bug: no message; trace the values, and start at the edges of loops. 4. Runtime error: a typo in a name (`totl` for `total`).',
       hints=['Ask: did it start? Did it stop? Did it give a wrong answer without stopping?'],
       why='The kind of problem tells you what to do next: fix the shape of the code, read the line the error names, or start tracing the values.'),
    CHECK('code-8-ch-checkpoint', 'Debugging checkpoint',
          Q('A program runs to the end and prints a wrong answer, with no error. What kind of problem is it?',
            [('A logic bug', True), ('A syntax error', False), ('A runtime error', False), ('The computer is broken', False)],
            'Logic bugs give no message, which is why they are hardest: the program is doing what you said, not what you meant.'),
          Q('Which line of a Python error message should you read first?',
            [('The last one, which says what went wrong', True), ('The first one, which says Traceback', False), ('The middle one', False), ('None of them: error messages are not useful', False)],
            'Read from the bottom: the last line is the kind and explanation, the line above it is where. That is almost always enough.'),
          Q('A loop meant to run 5 times runs 4. What is the most likely cause?',
            [('An off-by-one error in the boundary', True), ('Loops can only run 4 times', False), ('A missing semicolon', False), ('Memory is full', False)],
            'Check whether the range or condition includes the last value: `range(1, 5)` stops at 4, and `i < 5` stops before 5.'),
          Q('What is the best first step when you find a bug?',
            [('Make it fail reliably, then shrink the program until the problem is small', True), ('Rewrite the whole program', False), ('Change several things at once and see if it helps', False), ('Add more code around it', False)],
            'Reproduce and shrink. A bug you can trigger on demand in five lines is nearly solved.')),

    H2('Where this goes next', 'next'),
    P('''Debugging is the one skill you will use in every language for the rest of your career. The [Python part has a whole chapter on it](#py-errors) (tracebacks, exceptions, `try`/`except`, `pytest`), and [DevTools and the Console](#devtools)
    gives you the browser's debugger for JavaScript, which is the stepper you have been using, only for real programs. The [next chapter](#code-objects) is the last of the big ideas: building your own kinds of thing.'''),
]

terms = [
    ('bug', 'a flaw in a program that makes it do something other than what was intended'),
    ('debugging', 'finding and fixing bugs'),
    ('syntax error', 'a mistake in the shape of the code, so the language cannot read it'),
    ('runtime error', 'an error that happens while the program is running, usually stopping it'),
    ('logic bug', 'the program runs but gives the wrong answer; no error message'),
    ('traceback', 'the report Python prints when a program crashes, showing the trail of calls and the error'),
    ('off-by-one error', 'a bug where something happens one time too many or too few, usually at a boundary'),
    ('assert', 'a check that stops the program with an error if a statement is false'),
    ('test', 'a small program that checks that a function gives the right answers'),
    ('reproduce', 'to make a bug happen reliably so you can study and fix it'),
]

CHAPTER = chapter('code-debug', 'When Things Go Wrong: Errors and Debugging',
                  'The three kinds of problem, reading error messages, the off-by-one error, a method for finding bugs, and tests that catch them for you',
                  'code-dicts', 50,
                  ['Tell syntax errors, runtime errors and logic bugs apart',
                   'Read a Python or JavaScript error message and find the line it names',
                   'Recognise and fix an off-by-one error',
                   'Use the debugging loop: reproduce, shrink, guess, look, fix',
                   'Write a small assert-based test that catches a bug'],
                  blocks, terms, level='basics', part='code', file='05.08-code-debug.gm')
