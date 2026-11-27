from lib import *

blocks = [
    P('''This part of the book teaches you to write code, and you do not need to have written any before. You will meet one small
    robot, **Bit**, who lives on a grid in a town called Gridtown and does *exactly* what your program says: nothing more, nothing
    less. Over ten chapters Bit learns to remember things, make decisions, repeat itself, reuse its own skills, keep lists and look
    things up. Each idea arrives three ways: **see it** (a stepper that shows the program running, one line at a time), **try it**
    (code you can edit and run right here) and **why it exists** (the problem the idea was invented to solve). That last one matters
    most. Syntax is easy to look up; knowing *when* to reach for an idea is the skill.'''),

    CALLOUT('try', 'Two languages, one idea', '''Every example is shown in **Python** and in **JavaScript**, line for line. Use the switch at the top of any example:
    **Python**, **JavaScript** or **Both** side by side. Your choice is remembered and applies to every example in the book. If you are
    new, pick one and ignore the other; the ideas are the same, and the later Python and JavaScript chapters will feel familiar
    whichever you chose. Nothing to install: the code runs in this page.'''),

    H2('What code is, really', 'code'),
    P('''A **program** is a list of instructions that a computer follows in order. The computer is extremely fast and perfectly
    obedient, and it has no common sense at all. Tell a person "make me a sandwich" and they fill in every gap: where the bread is,
    which knife, when to stop. A computer needs all of it spelled out. **Code** is the writing you use for those instructions, and a
    *programming language* is the set of rules for how to write them.'''),
    TABLE(['What you would say to a person', 'What a computer needs'], [
        ['Walk to the shop.', 'Face the door. Move forward 40 steps. Turn left. Move forward 12 steps.'],
        ['Make it a bit warmer.', 'Set the target temperature to 21.'],
        ['Tell me if it is late.', 'If the time is after 18:00, show the message.'],
        ['Do that for all of them.', 'Take the items one at a time and repeat these steps for each.'],
    ], 'Everyday instructions and the exact version'),
    CALLOUT('why', 'Why code exists', '''People are good at judgement and bad at repeating the same steps ten million times without one slip. Computers are the
    opposite. Code is how you hand the exact, repetitive part of a job to a machine and keep the judgement for yourself. The router in
    your home, the page you are reading and the app that shows your bus times are all instructions of this kind, written by someone
    who had to spell everything out.'''),

    H2('Meet Bit', 'bit'),
    P('''Bit is a delivery robot. It lives in a grid of squares and it can do a handful of things: roll forward one square, turn on the
    spot, pick something up and put it down, and answer a few questions about where it is. Every move costs one unit of **energy**,
    and a battery on the floor gives five back. Bit has no idea what you want. It only does the next instruction you gave it.
    Bit will be with you for the whole part, and the grid worlds in each chapter are where you try your ideas on something you can watch.'''),
    TABLE(['In the picture', 'What it is', 'What Bit can do with it'], [
        ['Hatched square', 'A wall', 'Nothing: moving into it crashes Bit'],
        ['Target rings', 'The goal pad', 'Stand on it to finish most missions'],
        ['Yellow battery', 'A battery', 'Pick it up for +5 energy'],
        ['Orange box', 'A parcel', 'Pick it up, carry it, put it down'],
        ['Blue square with an arrow', 'The dock', 'Put a parcel down here to deliver it'],
        ['The blue robot', 'Bit', 'Faces the way its little nose points'],
    ], 'The things in Bit’s world'),

    H2('Your first program', 'first'),
    P('''The first thing every programmer teaches a new language is how to make it say something. In Python that is `print`, and in
    JavaScript it is `console.log`. The words in quotation marks are a piece of **text** (programmers call it a *string*, a string of
    characters). Press **Run**. Then change the words and run it again.'''),
    TRY('Say hello',
        '''
        print("Hello, Gridtown!")
        print("My name is Bit.")
        ''',
        '''
        console.log("Hello, Gridtown!");
        console.log("My name is Bit.");
        '''),
    P('''Two instructions, run from the top down: first line one, then line two. That is the whole model of a program for this
    chapter, and most of programming is about how to bend it. The brackets after `print` and `console.log` hold what you want shown.
    The semicolons at the end of JavaScript lines mark where an instruction ends; Python uses the end of the line for that.'''),
    CALLOUT('try', 'Break it on purpose', '''Delete one of the closing quotation marks and run it. You get an error message that names the line. Errors are the computer
    telling you exactly where it got confused, and reading them is a skill you will practise in [chapter 8](#code-debug). Put the
    quotation mark back and run it again. Changing things to see what happens is the fastest way to learn.'''),
    TABLE(['Idea', 'Python', 'JavaScript'], [
        ['Show something on the screen', '`print("hi")`', '`console.log("hi");`'],
        ['A note to yourself (ignored by the computer)', '`# a comment`', '`// a comment`'],
        ['Where an instruction ends', 'at the end of the line', 'at the `;` (usually)'],
        ['Group instructions into a block', 'indent the lines', 'wrap them in `{ }`'],
        ['Text', '`"hi"` or `\'hi\'`', '`"hi"`, `\'hi\'` or backticks'],
        ['Naming style', '`snake_case`', '`camelCase`'],
    ], 'Same idea, different spelling'),
    P('''You do not need to memorise that table. You will see every row again, with pictures, in the chapters that follow.'''),

    H2('Watch a program run', 'watch'),
    P('''Reading code is the other half of the skill, and a program that has already finished tells you nothing about how it got there.
    So every idea in this part comes with a **stepper**: it runs a short program one line at a time. Press **Next** to run the
    highlighted line. Watch the **Screen** (what the program has printed so far; new text is marked) and the **Memory** (the boxes the
    program is keeping; you will meet them properly in the [next chapter](#code-vars)). The sentence underneath says in plain words what
    just happened or what is about to.'''),
    STEP('Instructions run top to bottom',
         '''
         print("Bit wakes up")
         print("Bit rolls out of the garage")
         print("Bit delivers a parcel")
         ''',
         '''
         console.log("Bit wakes up");
         console.log("Bit rolls out of the garage");
         console.log("Bit delivers a parcel");
         ''',
         {1: 'The first instruction. Nothing has run yet, so the screen is empty.',
          2: 'Line 1 has run and put its text on the screen. Now line 2, the next one down.',
          3: 'The last instruction. Order matters: swap two lines in the program and the story comes out in a different order.',
          'end': 'The program ran out of lines, so it stopped. **A program always stops where its instructions end.**'}),
    P('''The memory was empty because that program kept nothing. This one keeps a number, and changes it:'''),
    STEP('A program that remembers',
         '''
         lap = 1
         print("Lap", lap)
         lap = lap + 1
         print("Lap", lap)
         ''',
         '''
         let lap = 1;
         console.log("Lap", lap);
         lap = lap + 1;
         console.log("Lap", lap);
         ''',
         {1: 'Make a box called `lap` and put the number {lap} in it. It appears in Memory.',
          2: 'Show the word `Lap`, then whatever is in the `lap` box.',
          3: 'Work out `lap + 1` first, then put the answer, {lap}, back in the same box. The old value is gone.',
          4: 'Same instruction as line 2, but the box now holds a different number, so a different line comes out.',
          'end': 'One instruction, two different results, because the box changed in between. That is what **memory** is for.'}),

    H2('Bit’s first moves', 'moves'),
    P('''Now you give the instructions to Bit. Bit understands `move()`, which rolls it one square in the direction its nose points, and
    `turn_left()` and `turn_right()` (in JavaScript `turnLeft()` and `turnRight()`), which turn it on the spot without moving it.
    The brackets matter: `move` on its own does nothing, and `move()` is a command. Write one command per line, press **Run**, and
    watch Bit act the program out. **Step** shows one command at a time. The mission box says what has to be true at the end.'''),
    BITGRID('code-1-walk', 'Mission 1: walk to the flag',
            'Bit stands in a corridor facing east, and the goal pad is at the other end. Count the squares, then write the moves.',
            '''
            #######
            #>...G#
            #######
            ''', {'at': 'G'},
            '# Write your commands here, one per line.\n', '// Write your commands here, one per line.\n',
            'move()\nmove()\nmove()\nmove()', 'move();\nmove();\nmove();\nmove();',
            hint='The goal pad is four squares to the right of Bit, so Bit needs four `move()` commands. Try three first and see where Bit stops: it does not know where the goal is.',
            tools=['move']),
    P('''Bit cannot see the goal pad. It does not stop when it arrives. It does the instructions you wrote, and then it does nothing.
    Try three moves and see: the program is "correct" and the mission still fails, because the instructions did not say what you meant.
    Now a path with a corner in it.'''),
    BITGRID('code-1-corner', 'Mission 2: turn the corner',
            'The corridor bends. Bit starts facing east. Remember that a turn changes the way Bit faces but not where it is.',
            '''
            #####
            #>..#
            ###.#
            ###G#
            #####
            ''', {'at': 'G'},
            '# Move along the top, turn, then move down.\n', '// Move along the top, turn, then move down.\n',
            'move()\nmove()\nturn_right()\nmove()\nmove()', 'move();\nmove();\nturnRight();\nmove();\nmove();',
            hint='Two moves east, then turn right (Bit then faces south), then two moves down. If Bit turns the wrong way, swap `right` for `left`.',
            tools=['move', 'turn']),
    BITGRID('code-1-zigzag', 'Mission 3: around the wall',
            'A longer route with two turns. Plan it on paper first: how many squares east, which way to turn, how many squares south, which way to turn back, how many squares east.',
            '''
            ########
            #>..####
            ###.####
            ###.####
            ###....G
            ########
            ''', {'at': 'G'},
            '', '',
            'move()\nmove()\nturn_right()\nmove()\nmove()\nmove()\nturn_left()\nmove()\nmove()\nmove()\nmove()',
            'move();\nmove();\nturnRight();\nmove();\nmove();\nmove();\nturnLeft();\nmove();\nmove();\nmove();\nmove();',
            hint='Two moves east. Turn right. Three moves south. Turn left, so Bit faces east again. Four moves east.', tools=['move', 'turn']),
    CALLOUT('why', 'Why you plan before you type', '''Notice how much of that mission was thinking, not typing. You worked out the route first (two squares, turn, three squares ...) and
    only then wrote it as instructions. Programmers do the same on far bigger problems. The code is the last step. The skill is
    breaking a goal into steps small enough that a machine with no common sense can follow them. The next few chapters give you
    better tools for writing those steps (boxes, decisions, repeats, reusable skills), so you will not have to type every single move.'''),

    H2('Bugs happen', 'bugs'),
    P('''A **bug** is when the instructions do not say what you meant. Computers do not misread instructions. When a program does the
    wrong thing, the computer did exactly what it was told, and the fault is in the telling. Bit makes this easy to see, because a
    mistake has a visible result: it rolls into a wall. The next program is broken. Predict what it will do *before* you press Run,
    then run it and compare. That habit of **predict, run, compare, fix** is the heart of debugging.'''),
    BITGRID('code-1-fix', 'Mission 4: fix the crash',
            'This program is meant to take Bit to the goal pad, but it crashes. Find the mistake and fix it. Do not rewrite it; change as little as you can.',
            '''
            #####
            #>..#
            ###.#
            ###G#
            #####
            ''', {'at': 'G'},
            'move()\nmove()\nmove()\nturn_right()\nmove()\nmove()\n', 'move();\nmove();\nmove();\nturnRight();\nmove();\nmove();\n',
            'move()\nmove()\nturn_right()\nmove()\nmove()', 'move();\nmove();\nturnRight();\nmove();\nmove();',
            hint='Follow Bit square by square with your finger. After the third `move()` where is Bit, and what is in front of it?', tools=['move', 'turn']),
    CALLOUT('gotcha', 'Common first mistakes', '''Leaving off the brackets (`move` instead of `move()`). Mixing up left and right: Bit turns from *its own* point of view, not yours.
    Counting squares from the wrong place: count the squares Bit will *move into*, not the one it is standing on.
    In JavaScript, a missing semicolon usually works but a missing bracket or quote does not. Python is strict about
    **indentation**: every line of a simple program starts in the first column, and an accidental space at the start is an error.'''),

    H2('Two languages, one idea', 'two'),
    P('''You have now written the same ideas twice: a list of instructions, run top to bottom, one thing at a time. The two languages
    spell them differently, but a Python programmer reading JavaScript, or the reverse, can follow the plan in a few minutes.
    That is worth remembering whenever a new language looks strange: the *ideas* (boxes, decisions, repeats, reusable skills) carry
    over almost unchanged, and only the spelling is new.'''),
    TABLE(['', 'Python', 'JavaScript'], [
        ['Made in', '1991, for readability', '1995, for web pages'],
        ['You will mostly meet it', 'in scripts, automation, data and servers', 'in web pages, browsers and servers'],
        ['In this book', '[the Python part](#py-start)', '[the JavaScript chapters](#js-basics)'],
        ['What to expect', 'less punctuation, indentation does the grouping', 'more punctuation, braces do the grouping'],
    ], 'Which one first?'),
    P('''If you are unsure, start with Python: it has less punctuation to trip over. If your goal is web pages, start with JavaScript.
    Either way you can switch any time at the top of an example, and you will lose nothing.'''),

    H2('Practice', 'practice'),
    EX('code-1-ex-three-lines', 'Print three lines', 'py',
       'Write a program that prints exactly these three lines, in this order: `Gridtown`, `Bit`, `Delivery`.',
       'print("Gridtown")\nprint("Bit")\nprint("Delivery")',
       hints=['One `print` per line. The text goes inside quotation marks.'],
       why='Each `print` is one instruction, and instructions run in the order you wrote them. Three lines of output need three instructions.',
       starter='# print the three lines here\n',
       check='assert out.strip() == "Gridtown\\nBit\\nDelivery", "Print exactly three lines: Gridtown, Bit, Delivery."'),
    EX('code-1-ex-countdown', 'Countdown', 'js',
       'Write a program that prints the numbers `3`, `2`, `1` and then the word `Go!`, each on its own line.',
       'console.log(3);\nconsole.log(2);\nconsole.log(1);\nconsole.log("Go!");',
       hints=['Numbers do not need quotation marks; the word does.'],
       why='A number can be shown directly, but text must be in quotation marks so the computer does not mistake it for a name. You will type this out by hand now; in chapter 4 a loop will do it for you.',
       starter='// print the countdown here\n',
       check='assert(out.trim() === "3\\n2\\n1\\nGo!", "Print 3, 2, 1 and Go! on separate lines.");'),
    EX('code-1-ex-recipe', 'Write instructions for a robot', 'think',
       ['Bit has never made toast. Write the instructions for making one slice of toast as a numbered list that Bit could follow without any common sense.',
        'Then read your list as Bit would. Find two places where the instructions assume something Bit does not know.'],
       '1. Take one slice of bread out of the bag.\n2. Put the slice in the toaster slot.\n3. Push the lever down.\n4. Wait until the toaster pops up.\n5. Take the slice out and put it on a plate.\n\nAssumptions: how long to wait (until it pops), how Bit knows the bag is open, what "put it on a plate" means if there is no plate.',
       hints=['Ask of each step: could someone follow it if they had never seen toast?'],
       why='This is the same exercise as writing code, without the code. The gaps you find (what "done" means, what is already set up) are the places where programs have bugs.'),
    CHECK('code-1-ch-checkpoint', 'Meet Bit checkpoint',
          Q('In what order does a simple program run its instructions?',
            [('From the first line to the last, one at a time', True), ('All at once', False), ('From the last line to the first', False), ('In whatever order the computer thinks best', False)],
            'A program runs top to bottom unless something (later chapters) tells it to jump or repeat. That is why the order you write things matters.'),
          Q('Bit stands facing east and you call `turn_left()`. Which way does Bit face, and where is it?',
            [('Facing north, on the same square', True), ('Facing north, one square further along', False), ('Facing west, on the same square', False), ('Still facing east', False)],
            'A turn changes the way Bit faces and nothing else. Turning left from east gives north.'),
          Q('Your program has no mistakes in its spelling, but Bit stops three squares short of the goal. What kind of problem is it?',
            [('The instructions did not say what you meant (a bug in the plan)', True), ('The computer misread the program', False), ('Bit is broken', False), ('The goal is in the wrong place', False)],
            'Computers follow instructions exactly. A program that runs but does the wrong thing has a bug in the instructions, and debugging means finding which instruction does not say what you meant.'),
          Q('What is the main reason people write code?',
            [('To hand exact, repetitive work to a machine', True), ('Because computers cannot do anything without it being typed in a particular font', False), ('To make computers think for themselves', False), ('To make files smaller', False)],
            'Computers are fast and exact but have no judgement. Code is how you pass on the steps and keep the thinking for yourself.')),

    H2('Where this goes next', 'next'),
    P('''Bit needs a memory, so the [next chapter](#code-vars) is about boxes with labels. After that come decisions (`if`), repeats
    (loops), reusable skills (functions), lists, look-up tables, finding and fixing bugs, and building your own objects. The last chapter
    is a project that uses all of it. When you finish the part you will be ready for the rest of the book: the [shell chapters](#zsh-basics)
    use the same ideas to control the Mac, the [Python part](#py-start) goes much deeper into the language, and the [JavaScript
    chapters](#js-basics) take you into the browser.'''),
    P('''If you want a different angle on planning programs (pseudocode and flowcharts) before you go on, [Thinking Like a Programmer](#thinking)
    is the chapter just before this part.'''),
]

terms = [
    ('program', 'a list of instructions that a computer follows in order'),
    ('code', 'the instructions of a program, written in a programming language'),
    ('programming language', 'a set of rules for writing instructions a computer can follow, such as Python or JavaScript'),
    ('string', 'a piece of text in a program, written in quotation marks'),
    ('statement', 'one instruction in a program'),
    ('comment', 'a note in the code that the computer ignores'),
    ('bug', 'a place where the instructions do not say what the programmer meant'),
    ('debugging', 'finding and fixing bugs'),
    ('stepper', 'a tool that runs a program one line at a time so you can watch what it does'),
]

CHAPTER = chapter('code-hello', 'Meet Bit: Your First Programs',
                  'What code is for, how to read it, and how to make a robot do exactly what you say, in Python and in JavaScript',
                  'thinking', 40,
                  ['Say what a program is and why a computer needs exact instructions',
                   'Run the same tiny program in Python and in JavaScript and read what it prints',
                   'Step through a program one line at a time and read the Memory and Screen panels',
                   'Control Bit with move and turn commands, and predict where a program leaves it',
                   'Explain what a bug is and fix a program that crashes Bit'],
                  blocks, terms, level='basics', part='code', file='05.01-code-hello.gm')
