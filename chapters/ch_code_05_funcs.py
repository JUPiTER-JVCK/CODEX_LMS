from lib import *

blocks = [
    P('''Every program in the last two chapters had a problem you may have felt: the same few lines kept turning up. A U-turn is two `turn_left()`s. Going once around the ring was the
    same three moves, a pick-up and a turn, four times. Copying and pasting works, until you need to change the U-turn and have to find every copy. This chapter is about the
    solution: give a group of instructions **a name**, then use the name. That is a **function**, and it is the tool that turns a program from a long list into something with shape.'''),

    H2('Naming a sequence of steps', 'why'),
    P('''You have been using functions since the first chapter. `print`, `move`, `say` and `front_is_clear` are all functions somebody else wrote. You use them by name and you
    do not need to know how Bit's wheels turn or how text reaches the screen. Now you write your own.'''),
    CALLOUT('why', 'Why functions exist', '''Four reasons, in the order you will feel them. **No repeating yourself**: write the instructions once, use them from ten places. **Fix once**: a bug in a function is fixed in one place for everyone who uses it.
    **A name for an idea**: `turn_around()` says what the code *means*, which `turn_left(); turn_left()` never does, so a program built of well-named functions reads like a description of the job.
    **Hiding detail**: you can use a function without keeping all its insides in your head, and that is the only way anyone has ever written a program too big to understand in one go.'''),

    H2('Define it, then call it', 'define'),
    P('''Using a function takes two separate steps. **Defining** it says what the name means: the keyword (`def` in Python, `function` in JavaScript), the name, brackets, and an indented
    or braced block with the instructions inside. Defining does **not** run anything. **Calling** it, by writing the name with brackets, is what makes it run. You define once and call as often as you like.'''),
    STEP('Define once, call twice',
         '''
         def greet():
             print("Hello from Bit")

         greet()
         greet()
         ''',
         '''
         function greet() {
           console.log("Hello from Bit");
         }

         greet();
         greet();
         ''',
         {1: 'This line **defines** `greet`. Nothing prints. The instructions are only stored under the name, which is why `greet` now appears in Memory as a function.',
          4: 'A **call**. The arrow jumps into the function, and a new frame appears in Memory for it.',
          2: 'Inside the function: the instructions run in order, like any other lines.',
          5: 'A second call: the same instructions run again from the top.',
          ('ret', 2): 'The function has no more lines, so it is finished. The frame goes away and the arrow goes back to where the call was made.',
          'end': 'Two calls, one definition. If you change the message in the function, both calls change.'}),
    CALLOUT('gotcha', 'Common mistakes with define and call', '''Defining a function and never calling it: nothing happens, and it can look as if the program is broken. Writing the name without brackets (`greet` instead of `greet()`) does not call it.
    Calling a function before it is defined (in Python, above the `def`) is an error. In Python, forgetting the indent on the body, or the colon after the brackets.'''),

    H2('Inputs: parameters', 'params'),
    P('''A function that always does the identical thing is limited. `move()` moves one square, but what if you wanted to walk *n* squares? A function can receive values, called **parameters**. In the definition they are
    the names in the brackets: placeholder boxes that do not hold anything yet. In the call, the values you put in the brackets are the **arguments**, and they are copied into those boxes
    for the length of the call. Watch the boxes `robot` and `energy` appear inside the function, with different contents each time.'''),
    STEP('Calling with different values',
         '''
         def announce(robot, energy):
             print(robot, "has", energy, "energy")

         announce("Bit", 20)
         announce("Pip", 7)
         ''',
         '''
         function announce(robot, energy) {
           console.log(robot, "has", energy, "energy");
         }

         announce("Bit", 20);
         announce("Pip", 7);
         ''',
         {1: 'The definition lists two placeholders. They are not boxes yet, just names the function will use.',
          4: 'The call supplies the **arguments**, `"Bit"` and 20, in the same order as the parameters.',
          2: 'Inside the call, `robot` holds {robot} and `energy` holds {energy}. They are real boxes now, but only inside this call.',
          5: 'A second call with different arguments.',
          ('ret', 2): 'Done: the boxes belonging to this call are thrown away.'}),
    TABLE(['Word', 'Where it is', 'Example'], [
        ['**Parameter**', 'in the definition: a placeholder', '`robot` and `energy` in `def announce(robot, energy)`'],
        ['**Argument**', 'in the call: the real value', '`"Bit"` and `20` in `announce("Bit", 20)`'],
    ], 'Parameter or argument?'),

    H2('Answers: return', 'return'),
    P('''Functions can also give something back. `return` ends the function and hands a value to whoever called it, and that value takes the place of the call, like an answer written
    in the blank. Step through and watch the call `double(4)` turn into 8 and land in a box.'''),
    STEP('A function that answers',
         '''
         def double(n):
             return n * 2

         result = double(4)
         print(result)
         ''',
         '''
         function double(n) {
           return n * 2;
         }

         const result = double(4);
         console.log(result);
         ''',
         {1: 'Define `double`. It has one parameter, `n`.',
          4: 'Call it with 4. The right-hand side must be worked out first, so the arrow goes into the function before anything is stored.',
          2: 'Inside, `n` is {n}. The function works out `n * 2` and sends the answer back.',
          ('ret', 2): 'The frame hands back **8**. That value replaces the call `double(4)`.',
          5: 'The call has been replaced by 8, which was stored in `result`.'}),
    CALLOUT('gotcha', 'Printing is not returning', '''This one trips up almost everyone. `print` (or `console.log`) shows something to a **person** on the screen. `return` gives a value to the **program**, so other code can use it.
    A function that only prints cannot be used in `double(4) + 1`, because it gives nothing back. In Python a function with no `return` quietly gives back `None`; in JavaScript, `undefined`. If a result
    "disappears", check whether the function returns it or just prints it.'''),
    TRY('Return and then use the answer',
        '''
        def double(n):
            return n * 2

        print(double(4) + 1)
        print(double(double(3)))
        ''',
        '''
        function double(n) {
          return n * 2;
        }

        console.log(double(4) + 1);
        console.log(double(double(3)));
        '''),
    P('''The second line is a function call used as the argument of another call: the inner `double(3)` runs first, gives 6, and 6 is what the outer one receives.'''),

    H2('Where boxes live', 'scope'),
    P('''When a function creates a box, the box belongs to **that call** and disappears when the call ends. Programmers say it has **local scope**. A box made outside every function
    has **global scope**. Two functions can use the same name for different boxes without colliding, and that is a feature: it means you can write one function without knowing every name used everywhere else.
    Step through and look at the **two** boxes called `energy` in Memory.'''),
    STEP('Two boxes, same name',
         '''
         energy = 10

         def recharge():
             energy = 99
             print("inside:", energy)

         recharge()
         print("outside:", energy)
         ''',
         '''
         let energy = 10;

         function recharge() {
           let energy = 99;
           console.log("inside:", energy);
         }

         recharge();
         console.log("outside:", energy);
         ''',
         {1: 'A global box: any code in the program can see it.', 3: 'Define the function. Its body will not run until it is called.', 7: 'Call it. A new frame opens.',
          4: 'This makes a **new** box named `energy` inside the function. It is a different box from the global one, so the global `energy` is untouched.',
          5: 'The inner box is the one the function sees.',
          ('ret', 5): 'The call ends and its own `energy` box is thrown away.',
          8: 'Back outside, the global `energy` is still {energy}. Functions can use their own boxes without disturbing anyone else.'}),
    CALLOUT('tip', 'A good habit: inputs in, answers out', '''A function that only works with the values you hand it and answers with `return` is easy to understand, to test and to reuse: it does not matter what else is going on in the program.
    A function that reaches out to change global boxes behind the scenes is the source of some of the hardest bugs there are. Prefer parameters in and `return` out.'''),

    H2('Functions that call functions', 'stack'),
    P('''A function can call another one, which can call another. The computer keeps a **call stack**: a pile of frames, one for each call that has started and not yet finished. The top
    one is the one running. When it returns, it comes off the pile and the one underneath carries on exactly where it stopped. Memory shows the stack as frames, innermost last.
    Watch it grow to three deep and shrink again.'''),
    STEP('A call stack three deep',
         '''
         def square(n):
             return n * n

         def sum_of_squares(a, b):
             return square(a) + square(b)

         print(sum_of_squares(3, 4))
         ''',
         '''
         function square(n) {
           return n * n;
         }

         function sum_of_squares(a, b) {
           return square(a) + square(b);
         }

         console.log(sum_of_squares(3, 4));
         ''',
         {1: 'Define `square`.', 4: 'Define `sum_of_squares`, which will use `square`.', 7: 'The call starts here: `sum_of_squares(3, 4)` is worked out first, then its answer is printed.',
          5: ['`sum_of_squares` runs and needs `square(a)`, so it calls it. A third frame opens.', '`square` has answered 9; now the second call, `square(b)`.', 'Both answers are in: add them and return.'],
          2: ['`square` is the innermost frame, so this is the one running. `n` is {n}.', 'Again, with a different `n`.'],
          ('ret', 2): 'The innermost frame is done and comes off the stack. The one underneath carries on.',
          ('ret', 5): 'The middle frame returns 25 to the line that called it.'}),
    P('''The function `sum_of_squares` does not know or care how `square` works; it only knows what `square` promises to do. That is **abstraction**, and it is why you can build large programs out of small
    ones you trust.'''),

    H2('Bit learns new skills', 'bit'),
    P('''Now teach Bit. Write a function once and use it as many times as you like. You can define a function in your program just as you do in the examples above, and Bit's commands (`move()`, `turn_left()`) can be used inside it.'''),
    BITGRID('code-5-there-back', 'Mission 1: there and back',
            'Bit stands next to the goal pad, facing the wrong way. Walk to the far end of the corridor, **turn around**, and walk back to the goal pad at the start. A U-turn is two left turns, so define a function called `turn_around` and use it. The corridor is a different length on each map.',
            '''
            #G>....#
            ########
            ''', {'at': 'G'},
            '# First define the function, then use it.\n', '// First define the function, then use it.\n',
            'def turn_around():\n    turn_left()\n    turn_left()\n\nwhile front_is_clear():\n    move()\nturn_around()\nwhile front_is_clear():\n    move()',
            'function turnAround() {\n  turnLeft();\n  turnLeft();\n}\n\nwhile (frontIsClear()) {\n  move();\n}\nturnAround();\nwhile (frontIsClear()) {\n  move();\n}',
            hint='`def turn_around():` with the two turns indented underneath. Then: walk while the front is clear, `turn_around()`, walk while the front is clear again. (In JavaScript, `function turnAround() { ... }`.)',
            tools=['move', 'turn', 'front'], energy=40,
            more=['''
                  #G>..........#
                  ##############
                  ''', '''
                  #G>.#
                  #####
                  ''']),
    BITGRID('code-5-walk', 'Mission 2: a skill with an input',
            'This route has four straight sections of different lengths. A helper that walks a given number of squares would keep the program short, so you are limited to **11 lines**: typing every `move()` would take 14. Define `walk(n)`, then call it for each section: 3 east, 2 south, 4 east, 2 north.',
            '''
            ##########
            #>...###G#
            ####.###.#
            ####.....#
            ##########
            ''', {'at': 'G', 'maxLines': 11},
            '# Define walk(n), then call it four times with turns in between.\n', '// Define walk(n), then call it four times with turns in between.\n',
            'def walk(n):\n    for i in range(n):\n        move()\n\nwalk(3)\nturn_right()\nwalk(2)\nturn_left()\nwalk(4)\nturn_left()\nwalk(2)',
            'function walk(n) {\n  for (let i = 0; i < n; i++) {\n    move();\n  }\n}\n\nwalk(3);\nturnRight();\nwalk(2);\nturnLeft();\nwalk(4);\nturnLeft();\nwalk(2);',
            hint='`walk(n)` is a loop that calls `move()` n times. Then the route is `walk(3)`, `turn_right()`, `walk(2)`, `turn_left()`, `walk(4)`, `turn_left()`, `walk(2)`.',
            tools=['move', 'turn']),
    BITGRID('code-5-return', 'Mission 3: a function that answers',
            'Write a function `cost(distance)` that **returns** twice the distance (each square costs two energy for this delivery company), then ask Bit to say `Cost: 14` for a trip of 7 squares. The function must `return` the answer rather than say it, so the line that calls it can build the sentence.',
            '''
            #####
            #>..#
            #####
            ''', {'says': ['Cost: 14']},
            '# Define cost(distance), then make Bit say the cost of 7 squares.\n', '// Define cost(distance), then make Bit say the cost of 7 squares.\n',
            'def cost(distance):\n    return distance * 2\n\nsay(f"Cost: {cost(7)}")',
            'function cost(distance) {\n  return distance * 2;\n}\n\nsay(`Cost: ${cost(7)}`);',
            hint='The function is one line: `return distance * 2`. The call can sit inside the f-string (`{cost(7)}`) or the template literal (`${cost(7)}`).',
            tools=['say']),

    H2('Writing good functions', 'good'),
    TABLE(['Habit', 'Why', 'Example'], [
        ['One job per function', 'easy to name, test and reuse', '`turn_around` turns; it does not also walk'],
        ['Name it for what it does', 'the call should read like a sentence', '`deliver_parcel()`, not `do_stuff()`'],
        ['Keep it short', 'if you cannot see it all at once, split it', 'aim for a screenful at most'],
        ['Inputs in, answer out', 'no hidden dependence on other boxes', '`cost(distance)` returns, it does not change a global'],
        ['Return a value, do not just print it', 'the caller decides what to do with it', '`return total`, then print it where you need it'],
    ], 'Habits of good functions'),
    CALLOUT('deep', 'The rule of three', '''If you copy the same lines for the third time, make them a function. Once is a draft, twice is a coincidence, three times is a pattern, and a pattern wants a name.'''),

    H2('Practice', 'practice'),
    EX('code-5-ex-area', 'An area function', 'py',
       'Write a function `area(width, height)` that **returns** the area of a rectangle. (Return it; do not print it.)',
       'def area(width, height):\n    return width * height',
       hints=['Two parameters, and a `return` of their product.'],
       why='A function that returns can be used anywhere a number can: `area(3, 4) + area(1, 1)`. If it printed instead, you could not combine the results.',
       starter='def area(width, height):\n    ...\n',
       check='assert area(3, 4) == 12, "area(3, 4) should be 12"\nassert area(1, 1) == 1, "area(1, 1) should be 1"\nassert area(0, 5) == 0, "area(0, 5) should be 0"\nassert area(2, 3) + area(1, 1) == 7, "the answers should be numbers you can add"'),
    EX('code-5-ex-grade', 'A grade function', 'py',
       'Write `grade(score)` that returns `"A"` for 90 or more, `"B"` for 80 to 89, `"C"` for 70 to 79 and `"F"` for anything lower. Use `if`/`elif`/`else` and `return` in each branch.',
       'def grade(score):\n    if score >= 90:\n        return "A"\n    elif score >= 80:\n        return "B"\n    elif score >= 70:\n        return "C"\n    else:\n        return "F"',
       hints=['A `return` ends the function straight away, so you do not need `else` between the earlier branches if you prefer, but an `elif` ladder reads clearly.'],
       why='Functions and decisions fit together: each branch returns, and the first that matches ends the call. Check the boundaries: 90, 89, 80, 79, 70, 69.',
       starter='def grade(score):\n    ...\n',
       check='for s, g in [(100, "A"), (90, "A"), (89, "B"), (80, "B"), (79, "C"), (70, "C"), (69, "F"), (0, "F")]:\n    assert grade(s) == g, "grade(%d) should be %s but is %r" % (s, g, grade(s))'),
    EX('code-5-ex-even', 'Is it even?', 'js',
       'Write a function `isEven(n)` that returns `true` when `n` is even and `false` when it is odd. (Hint: the remainder operator `%`.)',
       'function isEven(n) {\n  return n % 2 === 0;\n}',
       hints=['An even number has remainder 0 when divided by 2. The comparison itself is already `true` or `false`, so you can return it directly.'],
       why='A comparison produces a yes/no value, so a function can return the comparison and nothing else. Writing `if (...) { return true; } else { return false; }` does the same in more words.',
       starter='function isEven(n) {\n  // return true or false\n}\n',
       check='assert(typeof isEven === "function", "Define a function named isEven.");\nassert(isEven(4) === true, "isEven(4) should be true");\nassert(isEven(7) === false, "isEven(7) should be false");\nassert(isEven(0) === true, "0 is even");\nassert(isEven(-2) === true, "-2 is even");'),
    EX('code-5-ex-scope', 'What does it print?', 'think',
       ['Predict the output, then check it in the stepper in the scope section:',
        {'t': 'code', 'lang': 'text', 'attrs': {}, 'code': 'x = 5\n\ndef change():\n    x = 50\n    return x + 1\n\ny = change()\nprint(x)\nprint(y)', 'line': 1},
        'What do `print(x)` and `print(y)` show, and why is `x` not 50?'],
       'It prints 5 and then 51. The `x = 50` inside `change` makes a new local box, so the global `x` stays 5. The function returns 51, and that value is stored in `y`.',
       hints=['Count the boxes called `x`. How many are there, and which one does the last `print` see?'],
       why='Boxes created inside a function belong to that call. This is why you can reuse short names like `n` and `x` in many functions without them interfering.'),
    CHECK('code-5-ch-checkpoint', 'Functions checkpoint',
          Q('What does defining a function do?',
            [('Stores its instructions under a name; nothing runs until it is called', True), ('Runs it once immediately', False), ('Runs it every time the program starts a new line', False), ('Deletes the old version of the program', False)],
            'Definition and call are separate steps. Defining only attaches the name to the instructions.'),
          Q('What is the difference between a parameter and an argument?',
            [('A parameter is the placeholder in the definition; an argument is the real value in the call', True), ('They are the same thing', False), ('A parameter is the answer a function returns', False), ('An argument is the name of the function', False)],
            '`def double(n)`: `n` is a parameter. `double(4)`: 4 is an argument.'),
          Q('A function ends with `print(total)` and has no `return`. What does `x = f() + 1` do?',
            [('It fails, because the function gives back nothing (None / undefined) to add 1 to', True), ('It stores total plus 1 in x', False), ('It prints total', False), ('It stores 1 in x', False)],
            'A function that only prints gives back nothing. If the result is needed elsewhere, it has to `return` it.'),
          Q('A function creates a box called `count`. When does that box disappear?',
            [('When the call to the function ends', True), ('When the program ends', False), ('Never', False), ('When the next line runs', False)],
            'Boxes made inside a function are local to that call. That is why two functions can safely use the same name.')),

    H2('Where this goes next', 'next'),
    P('''You can now write a program that remembers, decides, repeats and has its own named skills. What it still cannot do is deal with **many** things at once. Bit's route, a list of parcels, the
    devices on a network. That is the [next chapter](#code-lists). Functions come back in the shell as well ([Shell Scripting](#scripting) uses `name() { ... }`) and get a much fuller treatment in
    [Python Flow](#py-flow) (default arguments, `*args`, keyword arguments) and in [JavaScript in Depth](#js-deeper) (arrow functions, closures, `async`).'''),
]

terms = [
    ('function', 'a named group of instructions that can be run by calling its name'),
    ('define', 'to write a function so the name is attached to its instructions (it does not run yet)'),
    ('call', 'to run a function by writing its name with brackets'),
    ('parameter', 'a placeholder name in a function definition that receives a value when the function is called'),
    ('argument', 'the actual value passed to a function in a call'),
    ('return', 'to end a function and hand a value back to the code that called it'),
    ('scope', 'where a name can be used; a box made inside a function is local to it'),
    ('local variable', 'a box created inside a function, which disappears when the function ends'),
    ('global variable', 'a box created outside every function'),
    ('call stack', 'the pile of unfinished function calls; the top one is the one running'),
    ('abstraction', 'using something by what it does, without needing to know how it works inside'),
]

CHAPTER = chapter('code-funcs', 'Functions: Teaching Bit New Skills',
                  'Naming a group of instructions: defining and calling, parameters, return values, scope and the call stack, and why good programs are built from small named pieces',
                  'code-loops', 50,
                  ['Define a function and call it by name',
                   'Give a function inputs (parameters) and get an answer out (return)',
                   'Tell printing a value apart from returning it',
                   'Explain scope: why the boxes inside a function are private to the call',
                   'Read the call stack when one function calls another',
                   'Split a program into small, well-named functions'],
                  blocks, terms, level='basics', part='code', file='05.05-code-funcs.gm')
