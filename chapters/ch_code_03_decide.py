from lib import *

blocks = [
    P('''Until now every program ran every line, top to bottom, no matter what. Bit would happily roll straight into a wall because you
    told it to move and it had no way to look first. Real programs are not like that. A thermostat switches the heating on *if* the room is
    cold. A login page lets you in *if* the password matches. A game ends *if* your health reaches zero. This chapter is about the single
    idea behind all of them: a program that **asks a question and chooses what to do next**.'''),

    H2('Programs that react', 'why'),
    P('''A decision has three parts: a **question** that can only be answered yes or no, an instruction to do when the answer is yes, and
    (optionally) another to do when it is no. Programmers call the question a **condition**. The programs you write become flexible
    because of it: the same instructions give different results depending on what is true at the moment they run.'''),
    CALLOUT('why', 'Why decisions exist', '''Without them every program is a fixed script: it can only ever do what you predicted when you wrote it. With them, one program can
    cope with situations you did not list one by one. "If the road ahead is blocked, turn." You do not need to know where the walls are in advance. This is why a delivery robot, a spam
    filter and a spreadsheet formula all contain the same word, `if`.'''),

    H2('Questions with yes/no answers', 'questions'),
    P('''A question in code is a **comparison**: you put two values on either side of a symbol and the computer answers `True` or `False`
    (`true` or `false` in JavaScript). This is the yes/no kind of value from the [last chapter](#code-vars), and in the stepper it is drawn as a
    switch. Step through and watch three answers come out of one number.'''),
    STEP('Asking questions',
         '''
         energy = 8
         low = energy < 10
         full = energy >= 20
         exact = energy == 8
         print("checked")
         ''',
         '''
         let energy = 8;
         let low = energy < 10;
         let full = energy >= 20;
         let exact = energy === 8;
         console.log("checked");
         ''',
         {1: 'Bit has {energy} energy.', 2: 'Is 8 less than 10? Yes, so `low` becomes true (switch on).', 3: 'Is 8 at least 20? No, so `full` becomes false (switch off).',
          4: 'Is 8 equal to 8? Yes. Notice the **two** equals signs: that is the question. One equals sign would have been an instruction.', 5: 'Three questions, three answers, all kept in boxes.'}),
    TABLE(['Symbol', 'Asks', 'Example', 'Answer when `energy` is 8'], [
        ['`==`  (`===` in JS)', 'are they equal?', '`energy == 8`', 'yes'],
        ['`!=`  (`!==` in JS)', 'are they different?', '`energy != 8`', 'no'],
        ['`<`', 'is the left smaller?', '`energy < 10`', 'yes'],
        ['`>`', 'is the left bigger?', '`energy > 10`', 'no'],
        ['`<=`', 'smaller or equal?', '`energy <= 8`', 'yes'],
        ['`>=`', 'bigger or equal?', '`energy >= 9`', 'no'],
    ], 'Comparison operators'),
    CALLOUT('gotcha', '`=` stores, `==` asks', '''The most common beginner slip in either language: writing one equals sign where you meant two. `energy = 8` puts 8 in the box. `energy == 8` asks
    whether the box holds 8. Python refuses `if energy = 8:` with a syntax error, which helps. JavaScript has a third spelling, `==`, that quietly converts types before comparing
    (so `"8" == 8` is true). **Always write `===` in JavaScript.** It asks "same value *and* same kind?", which is what you nearly always mean.'''),

    H2('if: do it only when', 'if'),
    P('''An `if` takes a condition and a **block** of instructions. The block runs when the answer is yes and is skipped when it is no.
    Python marks the block by **indenting** it (four spaces) after a colon. JavaScript wraps it in curly braces and puts the condition
    in brackets. The line after the block runs either way, because it is not inside it. Step through this program twice: the same code,
    but with a different number in the box, so a different path.'''),
    STEP('The answer is yes',
         '''
         energy = 3
         if energy < 5:
             print("Low battery: go and recharge")
         print("Back to work")
         ''',
         '''
         let energy = 3;
         if (energy < 5) {
           console.log("Low battery: go and recharge");
         }
         console.log("Back to work");
         ''',
         {1: 'The battery has {energy}.', 2: 'The question: is 3 less than 5? Yes, so the block underneath will run.',
          3: 'Inside the block, so it runs only because the answer was yes.', 4: 'Not indented, so not part of the `if`. It runs whatever the answer was.'}),
    STEP('The answer is no',
         '''
         energy = 12
         if energy < 5:
             print("Low battery: go and recharge")
         print("Back to work")
         ''',
         '''
         let energy = 12;
         if (energy < 5) {
           console.log("Low battery: go and recharge");
         }
         console.log("Back to work");
         ''',
         {1: 'This time the battery has {energy}.', 2: 'Is 12 less than 5? No. Watch where the arrow goes next: it **jumps over** the block.',
          4: 'The block was skipped; this line was never part of it. The dots in the margin mark the lines that ran, so you can see the path the program took.'}),
    CALLOUT('deep', 'Indentation is not decoration in Python', '''In Python, the spaces at the start of a line **are** the structure: they say which lines belong to the `if`. Use four spaces, and use the same number for every line in the block.
    JavaScript does not care about spaces, only about the `{ }`, but indenting inside braces is the convention everywhere because humans need it. If you mix them up, the program will do something
    different from what it looks like.'''),

    H2('else: two paths', 'else'),
    P('''Often you want to do one thing when the answer is yes and a different thing when it is no. `else` is the "otherwise" branch. Exactly one of the two blocks
    runs, never both and never neither.'''),
    STEP('One or the other',
         '''
         energy = 12
         if energy < 5:
             print("Recharge")
         else:
             print("Keep going")
         print("Done")
         ''',
         '''
         let energy = 12;
         if (energy < 5) {
           console.log("Recharge");
         } else {
           console.log("Keep going");
         }
         console.log("Done");
         ''',
         {1: 'Twelve in the box.', 2: 'Is 12 less than 5? No.', 4: 'The first block was skipped, so the computer arrives at `else` and runs the other block.',
          5: 'One path is taken; the other is skipped entirely.', 6: 'Back on the main road, whichever path was taken.'}),

    H2('Several branches: elif', 'elif'),
    P('''Sometimes there are more than two answers: a battery can be full, fine, low or critical. Chain the questions. Python calls the extra branches `elif` (else if), and
    JavaScript writes `else if`. The computer asks each question **in order** and runs the block for the first one that is yes, then skips the rest.'''),
    STEP('A ladder of questions',
         '''
         energy = 14
         status = ""
         if energy >= 20:
             status = "full"
         elif energy >= 10:
             status = "ok"
         elif energy >= 5:
             status = "low"
         else:
             status = "critical"
         print(status)
         ''',
         '''
         let energy = 14;
         let status = "";
         if (energy >= 20) {
           status = "full";
         } else if (energy >= 10) {
           status = "ok";
         } else if (energy >= 5) {
           status = "low";
         } else {
           status = "critical";
         }
         console.log(status);
         ''',
         {1: 'Fourteen in the box.', 2: 'An empty text box, ready to be filled in by whichever branch runs. (JavaScript needs the box to exist first; Python would allow you to skip this line.)',
          3: 'Is 14 at least 20? No, so try the next question.', 5: 'Is 14 at least 10? Yes. This branch wins.',
          6: 'The status becomes {status}.', 11: 'Whichever branch ran, we arrive here. The branches that were not chosen are not marked with a dot: they never ran.'}),
    CALLOUT('gotcha', 'Order matters on a ladder', '''Questions are asked top to bottom and the first yes wins. If you wrote `energy >= 5` first, then 14 would be called "low", because 14 is at least 5 and the
    computer never reaches the better-fitting question. Put the **most specific** test first.'''),
    TRY('Change the number',
        '''
        energy = 14
        if energy >= 20:
            status = "full"
        elif energy >= 10:
            status = "ok"
        elif energy >= 5:
            status = "low"
        else:
            status = "critical"
        print("Battery is", status)
        ''',
        '''
        let energy = 14;
        let status = "";
        if (energy >= 20) {
          status = "full";
        } else if (energy >= 10) {
          status = "ok";
        } else if (energy >= 5) {
          status = "low";
        } else {
          status = "critical";
        }
        console.log("Battery is", status);
        '''),
    P('''Try 25, 10, 9, 4 and 0 (watch what happens at exactly 10 and 5). Boundaries are where decision bugs live.'''),

    H2('And, or, not', 'logic'),
    P('''One question is often not enough. Bit should go and deliver only if it has a parcel **and** enough energy. It should recharge if the battery is low **or** it is on a charger.
    You join questions with three small words. Python spells them out; JavaScript uses symbols.'''),
    TABLE(['Meaning', 'Python', 'JavaScript', 'True when'], [
        ['both', '`a and b`', '`a && b`', 'a and b are both true'],
        ['at least one', '`a or b`', '`a || b`', 'either or both is true'],
        ['the opposite', '`not a`', '`!a`', 'a is false'],
    ], 'Combining questions'),
    STEP('Two conditions, one decision',
         '''
         energy = 15
         parcel = True
         ready = energy > 10 and parcel
         if ready:
             print("Go deliver")
         else:
             print("Wait")
         ''',
         '''
         let energy = 15;
         let parcel = true;
         let ready = energy > 10 && parcel;
         if (ready) {
           console.log("Go deliver");
         } else {
           console.log("Wait");
         }
         ''',
         {1: 'Fifteen energy.', 2: 'Bit has a parcel: a yes/no box.', 3: 'Is the energy above 10 **and** does Bit have a parcel? Both are yes, so `ready` is true. Change either one to no and it flips.',
          4: 'A box that already holds true or false can be used as the condition by itself.', 5: 'The first block runs.', 'end': 'Try this one in your head with `parcel` false: which line would the arrow reach?'}),
    CALLOUT('why', 'Why name a condition', '''Putting a long question into a box with a clear name (`ready`, `can_deliver`) makes the `if` read like a sentence. Compare `if ready:` with
    `if energy > 10 and parcel and not raining and door_open:`. Both work. Only one can be understood at a glance.'''),

    H2('Bit looks before it steps', 'sensors'),
    P('''Bit has a few **sensors**: commands that ask a question about its surroundings and answer yes or no. `front_is_clear()` (JavaScript:
    `frontIsClear()`) is true when the square ahead is not a wall. `on_battery()` is true when Bit is standing on a battery, and `on_goal()`
    when it is on the goal pad. Use them as the condition of an `if` and Bit stops running into things.'''),
    P('''These missions have **several maps**. Use the buttons above the grid to switch between them, and press **Check all maps** when you think the program is ready.
    That is the point of a decision: one program that works on every map, not a different program for each.'''),
    BITGRID('code-3-pick', 'Mission 1: pick it up if it is there',
            'Bit moves one square. Sometimes there is a battery on that square and sometimes not. Pick the battery up when there is one, and do nothing when there is not. (`take()` on an empty square crashes Bit.)',
            '''
            #####
            #>B..
            #####
            ''', {'collect': 'all'},
            '# Move one square, then pick up a battery only if Bit is on one.\nmove()\n',
            '// Move one square, then pick up a battery only if Bit is on one.\nmove();\n',
            'move()\nif on_battery():\n    take()', 'move();\nif (onBattery()) {\n  take();\n}',
            hint='`if on_battery():` then, indented underneath, `take()`. In JavaScript: `if (onBattery()) { take(); }`.',
            tools=['move', 'onb', 'take'],
            more=['''
                  #####
                  #>...
                  #####
                  ''', '''
                  ######
                  #>B.##
                  ######
                  ''']),
    BITGRID('code-3-wall', 'Mission 2: wall or no wall',
            'Bit must reach the goal pad. On some maps the way ahead is clear and the goal is one square in front. On others there is a wall in front and the goal is to the left. One program has to handle both: look first, then choose.',
            '''
            ####
            #>G#
            ####
            ''', {'at': 'G'},
            '# Look before you move.\n', '// Look before you move.\n',
            'if front_is_clear():\n    move()\nelse:\n    turn_left()\n    move()',
            'if (frontIsClear()) {\n  move();\n} else {\n  turnLeft();\n  move();\n}',
            hint='Ask `front_is_clear()`. If yes, `move()`. Otherwise `turn_left()` and then `move()`. Check that it works on Map 1 and on Map 2.',
            tools=['move', 'turn', 'front'],
            more=['''
                  ####
                  #G##
                  #>##
                  ####
                  ''', '''
                  #G##
                  #>##
                  ####
                  ''']),
    CALLOUT('gotcha', 'Common mistakes with if', '''A missing colon after the condition (Python) or missing brackets and braces (JavaScript). Indenting the line after the `if` by the wrong amount. Writing `=` where you meant `==`.
    Writing two `if`s when you meant `if` and `else` (both blocks might run). Asking questions in the wrong order on an `elif` ladder. When a program takes the wrong branch, **print or step the value in the condition**:
    nine times out of ten the box holds something other than what you assumed.'''),

    H2('Practice', 'practice'),
    EX('code-3-ex-ladder', 'Battery status', 'py',
       'The program already has `energy = 14`. Print `ok` for 10 to 19, `low` for 5 to 9, `critical` below 5 and `full` for 20 or more. Use `if`, `elif` and `else`. Print exactly one word. Then try other numbers in `energy` to check every branch.',
       'energy = 14\nif energy >= 20:\n    print("full")\nelif energy >= 10:\n    print("ok")\nelif energy >= 5:\n    print("low")\nelse:\n    print("critical")',
       hints=['Start with the highest range and work down, as in the ladder above.'],
       why='A ladder tests from the most specific range to the broadest. Changing `energy` to 20, 10, 9, 5, 4 and 0 and checking each answer is how you test a decision: look at the boundaries.',
       starter='energy = 14\n# print full, ok, low or critical\n',
       check='assert out.strip() == "ok", "With energy = 14 the program should print ok."'),
    EX('code-3-ex-can-deliver', 'Can Bit deliver?', 'js',
       'The program has `energy = 15` and `parcel = true`. Print `Go` when Bit has more than 10 energy **and** a parcel, and `Wait` otherwise. Use `&&`.',
       'let energy = 15;\nlet parcel = true;\nif (energy > 10 && parcel) {\n  console.log("Go");\n} else {\n  console.log("Wait");\n}',
       hints=['Both conditions go in one pair of brackets, joined by `&&`.'],
       why='`&&` is true only when both sides are true, so changing either value to something else sends the program down the `else`. Try `parcel = false` and `energy = 5` to see both ways it can fail.',
       starter='let energy = 15;\nlet parcel = true;\n// print Go or Wait\n',
       check='assert(out.trim() === "Go", "With energy 15 and a parcel the program should print Go.");'),
    EX('code-3-ex-trace', 'Which branch runs?', 'think',
       ['Predict what this prints, then check with the stepper above (the ladder) or by running it:',
        {'t': 'code', 'lang': 'text', 'attrs': {}, 'code': 'energy = 12\nif energy >= 5:\n    print("low")\nelif energy >= 10:\n    print("ok")\nelse:\n    print("critical")', 'line': 1},
        'What is wrong with the order of the questions, and how would you fix it?'],
       'It prints `low`. Twelve is at least 5, so the first question is already yes, and the computer never reaches `energy >= 10`. Put the most specific test first: `if energy >= 10` ... `elif energy >= 5` ... else.',
       hints=['The computer stops at the first yes.'],
       why='An `elif` ladder is a sequence, not a table. If an earlier test is broader than a later one, the later one can never run.'),
    CHECK('code-3-ch-checkpoint', 'Decisions checkpoint',
          Q('What is the difference between `=` and `==` (JavaScript: `===`)?',
            [('`=` puts a value in a box; `==` asks whether two values are equal', True), ('They mean the same thing', False), ('`=` compares and `==` stores', False), ('`==` is only used for text', False)],
            'One equals sign is an instruction (store), two is a question (compare). Mixing them up is the most common beginner slip.'),
          Q('In an `if` / `elif` / `else` chain, how many blocks run?',
            [('Exactly one: the first whose condition is true, or the `else` if none is', True), ('All of them', False), ('Every block whose condition is true', False), ('None, unless you write `else`', False)],
            'The ladder is searched top to bottom and stops at the first yes. That is also why the order of the questions matters.'),
          Q('`energy > 10 and parcel`: when is this true?',
            [('Only when the energy is above 10 and the parcel is true', True), ('When either one is true', False), ('Whenever the energy is above 10', False), ('Only when the parcel is false', False)],
            '`and` needs both sides to be true. `or` needs at least one.'),
          Q('Why did the missions have several maps?',
            [('To show that a good program works in every situation, not one lucky layout', True), ('To make the missions harder for no reason', False), ('Because Bit can only run on one map at a time', False), ('So you could write a different program for each map', False)],
            'That is what a decision is for: the same instructions give the right answer when the situation changes.')),

    H2('Where this goes next', 'next'),
    P('''Decisions let one program handle many situations, but Bit still has to be told to move every single square. Moving forty squares needs forty `move()` lines, unless the program can do something
    **again and again**. That is the [next chapter](#code-loops). You will meet the same `if` in the shell ([Shell Scripting](#scripting) writes it as `if [[ ... ]]; then`) and in [Python Flow](#py-flow), which covers `match`
    and conditional expressions on top of what you have just learned.'''),
]

terms = [
    ('condition', 'a question in code that is either true or false'),
    ('comparison', 'a condition made by putting a symbol such as < or == between two values'),
    ('if statement', 'runs a block of code only when its condition is true'),
    ('else', 'the branch that runs when the if condition is false'),
    ('elif / else if', 'an extra question, asked only when the earlier ones were false'),
    ('branch', 'one of the paths a program can take at a decision'),
    ('block', 'the group of instructions that belongs to an if, else or loop'),
    ('and / or / not', 'words (&&, || and ! in JavaScript) that combine or reverse yes/no answers'),
    ('sensor', 'a command that asks about the situation and answers true or false, such as front_is_clear()'),
]

CHAPTER = chapter('code-decide', 'Decisions: if, else and True/False',
                  'Making a program choose: comparisons, if, else, elif, and, or, not, and a robot that looks before it steps',
                  'code-vars', 45,
                  ['Ask yes/no questions with comparisons and read the True/False answer',
                   'Make a program choose between paths with if, elif / else if and else',
                   'Combine questions with and, or and not',
                   'Use Bit’s sensors so one program works on many maps',
                   'Follow which branch ran by watching the stepper’s path'],
                  blocks, terms, level='basics', part='code', file='05.03-code-decide.gm')
