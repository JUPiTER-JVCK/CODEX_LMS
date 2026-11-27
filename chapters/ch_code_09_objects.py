from lib import *

blocks = [
    P('''Bit has friends now: Pip and Dot. Each robot has a name, an amount of energy and things it can do: move, charge, speak. You can already describe a robot as a dictionary and write functions that take it as
    an argument, and that works. But as a program grows, the data and the functions that belong with it drift apart, and nothing stops you handing a function the wrong sort of thing. This chapter is about
    keeping **the data and the actions together in one package**. That package is an **object**, and the blueprint you build it from is a **class**.'''),

    H2('Data and actions that belong together', 'why'),
    CALLOUT('why', 'Why objects exist', '''Big programs need structure, and the most natural structure is the one the world already has: things. A robot, a parcel, a bank account, a web request, a date. Each thing has **properties** (its data) and
    **abilities** (what it can do), and keeping them together means the code that changes a robot's energy sits next to the energy, so the rest of the program cannot get it wrong. You have been using objects since the beginning: a piece of text, a list and a dictionary are all
    objects, which is why `xs.append(3)` has a dot in it. A dot means "ask this object to do something". The libraries you will use for files, networks and dates are all made of classes. This chapter lets you read them, and write your own.'''),

    H2('The problem: things in pieces', 'problem'),
    P('''Here is the dictionary version you could write already. It works, but notice that `charge` is a separate function that *hopes* it is given a robot. Nothing connects the two.'''),
    STEP('Robots as dictionaries',
         '''
         bit = {"name": "Bit", "energy": 20}
         pip = {"name": "Pip", "energy": 7}

         def charge(robot):
             robot["energy"] += 5

         charge(pip)
         print(pip["energy"])
         ''',
         '''
         const bit = { name: "Bit", energy: 20 };
         const pip = { name: "Pip", energy: 7 };

         function charge(robot) {
           robot["energy"] += 5;
         }

         charge(pip);
         console.log(pip["energy"]);
         ''',
         {1: 'Two robots, each a dictionary.', 2: 'The second one.', 4: 'A separate function that changes a robot.', 7: 'Call it with Pip.',
          5: 'The function receives the **same dictionary** (notice "same object as pip"), so changing it changes Pip. Fine, but `charge(5)` or `charge("hello")` would be accepted too, and fail somewhere confusing.',
          8: 'It works. But the data and the code that works on it are two separate things the programmer has to keep matching.'}),

    H2('A class is a blueprint; an object is the thing built', 'class'),
    P('''A **class** describes a *kind* of thing: what data each one has and what each one can do. It is a blueprint, not a robot. An **object** (also called an **instance**) is one real robot built from the blueprint. You can build as many as you like, and each has its own data.
    Step through and watch two robots appear.'''),
    STEP('Defining a class and building two robots',
         '''
         class Robot:
             def __init__(self, name, energy):
                 self.name = name
                 self.energy = energy

         bit = Robot("Bit", 20)
         pip = Robot("Pip", 7)
         print(pip.name)
         ''',
         '''
         class Robot {
           constructor(name, energy) {
             this.name = name;
             this.energy = energy;
           }
         }

         const bit = new Robot("Bit", 20);
         const pip = new Robot("Pip", 7);
         console.log(pip.name);
         ''',
         {1: 'Define the class `Robot`. Like a function definition, this stores the blueprint; it builds nothing yet. `Robot` appears in Memory as a class.',
          2: 'The special set-up routine. Python calls it `__init__`, JavaScript `constructor`. It runs **automatically** each time a new robot is built.',
          6: 'Build the first robot: `Robot("Bit", 20)` creates an empty object and runs the set-up routine on it.',
          3: 'Inside the set-up, `self` (JavaScript: `this`) means **the object being built**. `self.name = name` attaches a label called `name` to *this* robot and puts {name} in it.',
          4: 'And an `energy` label. A label stored on an object is called an **attribute** (or property).',
          7: 'The same blueprint again, with different values: a second, separate robot.',
          8: 'Read an attribute with a dot: the object, a dot, the label. Pip\'s name.'}),
    CALLOUT('deep', '`self`, `this` and `new`', '''Python methods take `self` as their first parameter, written out, and you *call* them without it (`Robot("Bit", 20)`, and later `pip.charge(5)`): Python fills `self` in for you. JavaScript has no such parameter: `this` just exists inside the methods,
    and you must write `new` when you build an object (`new Robot(...)`); forgetting it is a common bug. In both languages the idea is the same: **the object the method is being used on**.'''),

    H2('Methods: actions that belong to the object', 'methods'),
    P('''A function defined inside a class is called a **method**. It is how an object does things. When you write `pip.charge(5)`, the computer finds `charge` in the class and runs it with `self` set to `pip` and the amount set to 5. Watch the object card in Memory:
    `self` inside the method and `pip` outside are two names for the same object, and the energy changes in both.'''),
    STEP('A method changes its own object',
         '''
         class Robot:
             def __init__(self, name, energy):
                 self.name = name
                 self.energy = energy

             def charge(self, amount):
                 self.energy += amount

         pip = Robot("Pip", 7)
         pip.charge(5)
         print(pip.energy)
         ''',
         '''
         class Robot {
           constructor(name, energy) {
             this.name = name;
             this.energy = energy;
           }

           charge(amount) {
             this.energy += amount;
           }
         }

         const pip = new Robot("Pip", 7);
         pip.charge(5);
         console.log(pip.energy);
         ''',
         {1: 'The blueprint.', 2: 'The set-up routine.', 6: 'A method: a function that belongs to the class. Defining it does not run it.',
          9: 'Build Pip.', 3: 'Set the name.', 4: 'Set the energy.',
          10: 'Call the method on Pip. Python and JavaScript both pass `pip` in as `self` / `this`, and 5 as `amount`.',
          7: 'The method changes the object **it was called on**: `self` is Pip, so Pip\'s energy goes from 7 to 12. Look at the energy on the card.',
          11: 'Pip\'s energy is 12 now, and the object remembers it: that is the point of keeping data in an object.'}),

    H2('Many objects, one blueprint', 'many'),
    P('''Each object has its **own** attributes. Moving one robot costs that robot energy and no other. The blueprint is shared; the data is not. This is the answer to the problem at the start of the chapter: a thousand robots, one class.'''),
    STEP('Two robots, separate energy',
         '''
         class Robot:
             def __init__(self, name):
                 self.name = name
                 self.energy = 10

             def move(self):
                 self.energy -= 1

         bit = Robot("Bit")
         pip = Robot("Pip")
         bit.move()
         bit.move()
         print(bit.energy, pip.energy)
         ''',
         '''
         class Robot {
           constructor(name) {
             this.name = name;
             this.energy = 10;
           }

           move() {
             this.energy -= 1;
           }
         }

         const bit = new Robot("Bit");
         const pip = new Robot("Pip");
         bit.move();
         bit.move();
         console.log(bit.energy, pip.energy);
         ''',
         {1: 'The blueprint, with a method that spends one energy.', 9: 'Build Bit. It starts with 10.', 10: 'Build Pip, also with 10, in its own separate object.',
          11: 'Move Bit.', 12: 'Move Bit again. Only Bit\'s card changes.', 7: 'Inside `move`, `self` is {name}, so only that robot spends energy.',
          13: 'Bit has 8 and Pip still has 10. Same blueprint, independent data.'}),
    TRY('A whole fleet',
        '''
        class Robot:
            def __init__(self, name, energy):
                self.name = name
                self.energy = energy

            def charge(self, amount):
                self.energy += amount

        fleet = [Robot("Bit", 20), Robot("Pip", 7), Robot("Dot", 3)]
        for robot in fleet:
            robot.charge(5)
            print(robot.name, robot.energy)
        ''',
        '''
        class Robot {
          constructor(name, energy) {
            this.name = name;
            this.energy = energy;
          }

          charge(amount) {
            this.energy += amount;
          }
        }

        const fleet = [new Robot("Bit", 20), new Robot("Pip", 7), new Robot("Dot", 3)];
        for (const robot of fleet) {
          robot.charge(5);
          console.log(robot.name, robot.energy);
        }
        '''),
    P('''Lists of objects, loops over them, a method call inside the loop: everything from the earlier chapters, working together. Add a fourth robot to the list and the loop handles it with no other change.'''),

    H2('Dictionary or class?', 'choose'),
    TABLE(['Use a dictionary when', 'Use a class when'], [
        ['you just need to hold labelled data, especially data that arrives from outside (JSON from a web service)', 'the data comes with **behaviour**: things you want to do to it'],
        ['the shape is loose and may change', 'you want every thing to have the same shape, set up the same way'],
        ['a few lines of code use it', 'many functions would otherwise take the same dictionary as their first argument'],
        ['you are just exploring', 'you want rules enforced in one place (energy can never go below zero)'],
    ], 'A rule of thumb'),
    P('''Start simple. A dictionary is fine until you notice a group of functions that all take the same dictionary and know how it is laid out. That is the moment to wrap them in a class.'''),

    H2('Bit’s fleet', 'bit'),
    BITGRID('code-9-class', 'Mission 1: build the class',
            'Write a class `Robot` whose objects have a `name` and 10 `energy`, and a method `speak()` that makes Bit say `I am` followed by the robot\'s name. Then build a robot called Bit and one called Pip and make each speak. (Bit\'s commands, like `say`, can be used inside a method.)',
            '''
            ####
            #>.#
            ####
            ''', {'says': ['I am Bit', 'I am Pip']},
            '# Write the class, then build two robots and make them speak.\n', '// Write the class, then build two robots and make them speak.\n',
            'class Robot:\n    def __init__(self, name):\n        self.name = name\n        self.energy = 10\n\n    def speak(self):\n        say(f"I am {self.name}")\n\nbit = Robot("Bit")\npip = Robot("Pip")\nbit.speak()\npip.speak()',
            'class Robot {\n  constructor(name) {\n    this.name = name;\n    this.energy = 10;\n  }\n\n  speak() {\n    say(`I am ${this.name}`);\n  }\n}\n\nconst bit = new Robot("Bit");\nconst pip = new Robot("Pip");\nbit.speak();\npip.speak();',
            hint='A class with a set-up routine (`__init__` / `constructor`) that stores the name and energy on `self` / `this`, and a method `speak` that calls `say` with the name. Remember `new` in JavaScript.', tools=['say']),
    BITGRID('code-9-fleet', 'Mission 2: charge the fleet',
            'The class and the fleet are written for you. Add a loop that charges every robot by 5, then makes Bit say each robot\'s name and energy in the form `Bit: 25`.',
            '''
            ####
            #>.#
            ####
            ''', {'says': ['Bit: 25', 'Pip: 12', 'Dot: 8']},
            'class Robot:\n    def __init__(self, name, energy):\n        self.name = name\n        self.energy = energy\n\n    def charge(self, amount):\n        self.energy += amount\n\nfleet = [Robot("Bit", 20), Robot("Pip", 7), Robot("Dot", 3)]\n\n# charge every robot by 5, then say its name and energy\n',
            'class Robot {\n  constructor(name, energy) {\n    this.name = name;\n    this.energy = energy;\n  }\n\n  charge(amount) {\n    this.energy += amount;\n  }\n}\n\nconst fleet = [new Robot("Bit", 20), new Robot("Pip", 7), new Robot("Dot", 3)];\n\n// charge every robot by 5, then say its name and energy\n',
            'class Robot:\n    def __init__(self, name, energy):\n        self.name = name\n        self.energy = energy\n\n    def charge(self, amount):\n        self.energy += amount\n\nfleet = [Robot("Bit", 20), Robot("Pip", 7), Robot("Dot", 3)]\n\nfor robot in fleet:\n    robot.charge(5)\n    say(f"{robot.name}: {robot.energy}")',
            'class Robot {\n  constructor(name, energy) {\n    this.name = name;\n    this.energy = energy;\n  }\n\n  charge(amount) {\n    this.energy += amount;\n  }\n}\n\nconst fleet = [new Robot("Bit", 20), new Robot("Pip", 7), new Robot("Dot", 3)];\n\nfor (const robot of fleet) {\n  robot.charge(5);\n  say(`${robot.name}: ${robot.energy}`);\n}',
            hint='A `for` loop over `fleet`. Inside it, call `robot.charge(5)` and then say the sentence with `robot.name` and `robot.energy` in it.', tools=['say']),

    H2('Practice', 'practice'),
    EX('code-9-ex-counter', 'A counter', 'py',
       'Write a class `Counter`. A new counter starts with `count` equal to 0. It has a method `increment()` that adds 1 to `count`. Two counters must not affect each other.',
       'class Counter:\n    def __init__(self):\n        self.count = 0\n\n    def increment(self):\n        self.count += 1',
       hints=['Set `self.count = 0` in `__init__`, and add 1 to `self.count` in `increment`. Remember `self` is the first parameter of every method.'],
       why='Each object has its own `count`, because `self.count` belongs to the object, not to the class. A plain variable at the top of the class would be shared by all counters.',
       starter='class Counter:\n    ...\n',
       check='a = Counter()\nb = Counter()\nassert a.count == 0, "a new counter starts at 0"\na.increment()\na.increment()\nb.increment()\nassert a.count == 2, "a should be 2 after two increments"\nassert b.count == 1, "b is separate and should be 1"'),
    EX('code-9-ex-rectangle', 'A rectangle', 'py',
       'Write a class `Rectangle` that is built with a `width` and a `height` and has a method `area()` that **returns** the area and a method `is_square()` that returns `True` when the width and height are equal.',
       'class Rectangle:\n    def __init__(self, width, height):\n        self.width = width\n        self.height = height\n\n    def area(self):\n        return self.width * self.height\n\n    def is_square(self):\n        return self.width == self.height',
       hints=['Store both numbers in `__init__`. Each method uses `self.width` and `self.height`.'],
       why='The methods do not take width and height as arguments: the object already knows them. That is the advantage over a standalone function: the data travels with the object.',
       starter='class Rectangle:\n    ...\n',
       check='r = Rectangle(3, 4)\nassert r.area() == 12, "area of 3 by 4 is 12"\nassert r.is_square() is False, "3 by 4 is not a square"\nassert Rectangle(5, 5).is_square() is True, "5 by 5 is a square"\nassert Rectangle(2, 2).area() == 4, "2 by 2 is 4"'),
    EX('code-9-ex-drain', 'A robot that cannot go below zero', 'js',
       'Write a class `Robot` with a constructor taking `energy`, and a method `drain(n)` that subtracts `n` from the energy but **never lets it go below 0**. Then `drain` should return the new energy.',
       'class Robot {\n  constructor(energy) {\n    this.energy = energy;\n  }\n\n  drain(n) {\n    this.energy = Math.max(0, this.energy - n);\n    return this.energy;\n  }\n}',
       hints=['`Math.max(0, x)` gives 0 when `x` is negative. Or use an `if`.'],
       why='This is the second big reason for classes: the rule "energy cannot go negative" lives in one place, next to the data. Anything that drains a robot, anywhere in the program, gets the rule for free.',
       starter='class Robot {\n  // constructor(energy) and drain(n)\n}\n',
       check='assert(typeof Robot === "function", "Define a class named Robot.");\nconst r = new Robot(10);\nassert(r.drain(3) === 7, "10 minus 3 is 7");\nassert(r.energy === 7, "the object should remember 7");\nassert(r.drain(20) === 0, "energy must stop at 0");\nassert(new Robot(5).energy === 5, "the constructor sets the energy");'),
    EX('code-9-ex-design', 'What belongs in a class?', 'think',
       ['You are writing a program for a library. For a *book* (title, author, whether it is on loan), list: two attributes, and two methods you would give the class.',
        'Then say whether you would use a class or a dictionary for a result you receive from a web service as JSON, and why.'],
       'Attributes: `title`, `author`, `on_loan`. Methods: `borrow()` (marks it on loan, refusing if already out) and `return_book()`. For data arriving as JSON you would normally keep it as a dictionary (that is how it arrives, and the shape is controlled by the service), turning it into a class only if you need behaviour or rules.',
       hints=['Attributes are nouns (things it has), methods are verbs (things it does).'],
       why='Thinking "what does it have, what can it do" is the whole of object design at this level. If the behaviour you want is "check the rules before changing the data", that is a method.'),
    CHECK('code-9-ch-checkpoint', 'Objects and classes checkpoint',
          Q('What is the difference between a class and an object?',
            [('A class is a blueprint; an object is one real thing built from it', True), ('They are the same thing', False), ('A class is a kind of loop', False), ('An object is a blueprint and a class is the thing built', False)],
            'You write one class and can build as many objects from it as you like, each with its own data.'),
          Q('Inside a method, what does `self` (JavaScript: `this`) refer to?',
            [('The object the method is being used on', True), ('The class itself', False), ('The program', False), ('The first argument you typed in the call', False)],
            'When you write `pip.charge(5)`, `self` is `pip` inside `charge`. That is how a method knows which object to change.'),
          Q('You create two objects from the same class and change an attribute of one. What happens to the other?',
            [('Nothing: each object has its own attributes', True), ('It changes too', False), ('An error', False), ('Both are deleted', False)],
            'The blueprint is shared; the data is not. This is the whole point of having objects.'),
          Q('Which is the best reason to turn a dictionary and some functions into a class?',
            [('The functions all work on the same data and you want the rules in one place', True), ('Classes make programs run faster', False), ('Dictionaries cannot hold numbers', False), ('Classes are required by the language', False)],
            'Classes help organise code. If the data is just labelled data with no behaviour, a dictionary is simpler.')),

    H2('Where this goes next', 'next'),
    P('''That completes the toolbox: boxes, decisions, loops, functions, lists, dictionaries, debugging and objects. Every program you will write from here is a combination of these. The [last chapter](#code-capstone) is a project that uses all of them at
    once. Classes go much further in [Classes, Objects and Idiomatic Python](#py-oop) (inheritance, special methods, dataclasses) and in [JavaScript in Depth](#js-deeper) (prototypes, modules, async).'''),
]

terms = [
    ('class', 'a blueprint that describes the data and actions of a kind of thing'),
    ('object', 'one real thing built from a class, with its own data; also called an instance'),
    ('instance', 'an object made from a particular class'),
    ('attribute', 'a named piece of data stored on an object; also called a property'),
    ('method', 'a function that belongs to a class and works on one object'),
    ('constructor', 'the set-up routine that runs when an object is built: __init__ in Python, constructor in JavaScript'),
    ('self / this', 'inside a method, the object the method is being used on'),
    ('encapsulation', 'keeping data and the code that uses it together, so the rules live in one place'),
]

CHAPTER = chapter('code-objects', 'Blueprints: Objects and Classes',
                  'Keeping data and actions together: classes and objects, attributes, methods, self and this, and when a class is better than a dictionary',
                  'code-debug', 50,
                  ['Explain why related data and actions belong together',
                   'Write a class with attributes and methods in Python and JavaScript',
                   'Build several independent objects from one class',
                   'Say what self and this mean inside a method',
                   'Choose between a dictionary and a class'],
                  blocks, terms, level='basics', part='code', file='05.09-code-objects.gm')
