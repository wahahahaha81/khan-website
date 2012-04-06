import pbkdf2


def hash_password(raw_password, salt):
    """ Generates a strong one-way hash (effective 192 bits) for the
    specified password and salt.
    Both arguments are expected to be strings
    """
    return pbkdf2.crypt(raw_password, salt, iterations=5000)


def validate_password(raw_password, salt, expected):
    """ Returns whether or not the raw_password+salt combination hashes
    to the same value as expected, assuming it used hash_password. """
    return hash_password(raw_password, salt) == expected


MIN_PASSWORD_LENGTH = 8


def is_sufficient_password(raw_password, user_nickname="", user_username=""):
    """ Returns whether or not the password is sufficiently strong for use
    as a credential in Khan Academy.

    There is a general requirement of 8 characters for the password. However,
    additional checks can be made to ban common words or tokens that would
    be directly guessable given the user.
    """

    if not raw_password or len(raw_password) < MIN_PASSWORD_LENGTH:
        return False

    if raw_password.lower() in get_password_blacklist():
        return False

    nickname = user_nickname.lower()
    username = user_username.lower()
    personal_blacklist = set([nickname] + nickname.split(" ") + [username])
    if raw_password.lower() in personal_blacklist:
        return False
    return True


_blacklisted_passwords = None


def get_password_blacklist():
    """ Gets a list of banned passwords.

    This is seeded with Twitter's banned password list, with custom
    modifications for Khan Academy.

    """

    global _blacklisted_passwords

    if not _blacklisted_passwords:
        # Filter out blacklist entries that don't even meet the length limit.
        _blacklisted_passwords = set([pw for pw in [
            "000000",
            "111111",
            "11111111",
            "112233",
            "121212",
            "123123",
            "123456",
            "1234567",
            "12345678",
            "123456789",
            "131313",
            "232323",
            "654321",
            "666666",
            "696969",
            "777777",
            "7777777",
            "8675309",
            "987654",
            "aaaaaa",
            "abc123",
            "abcdef",
            "abgrtyu",
            "academy",
            "access",
            "access14",
            "action",
            "albert",
            "alberto",
            "alejandra",
            "alejandro",
            "alexis",
            "amanda",
            "amateur",
            "america",
            "andrea",
            "andrew",
            "angela",
            "angels",
            "animal",
            "anthony",
            "apollo",
            "apples",
            "arsenal",
            "arthur",
            "asdfgh",
            "ashley",
            "asshole",
            "august",
            "austin",
            "badboy",
            "bailey",
            "banana",
            "barney",
            "baseball",
            "batman",
            "beatriz",
            "beaver",
            "beavis",
            "bigcock",
            "bigdaddy",
            "bigdick",
            "bigdog",
            "bigtits",
            "birdie",
            "bitches",
            "biteme",
            "blazer",
            "blonde",
            "blondes",
            "blowjob",
            "blowme",
            "bond007",
            "bonita",
            "bonnie",
            "booboo",
            "booger",
            "boomer",
            "boston",
            "brandon",
            "brandy",
            "braves",
            "brazil",
            "bronco",
            "broncos",
            "bulldog",
            "buster",
            "butter",
            "butthead",
            "calvin",
            "camaro",
            "cameron",
            "canada",
            "captain",
            "carlos",
            "carter",
            "casper",
            "charles",
            "charlie",
            "cheese",
            "chelsea",
            "chester",
            "chicago",
            "chicken",
            "cocacola",
            "coffee",
            "college",
            "compaq",
            "computer",
            "consumer",
            "cookie",
            "cooper",
            "corvette",
            "cowboy",
            "cowboys",
            "crystal",
            "cumming",
            "cumshot",
            "dakota",
            "dallas",
            "daniel",
            "danielle",
            "debbie",
            "dennis",
            "diablo",
            "diamond",
            "doctor",
            "doggie",
            "dolphin",
            "dolphins",
            "donald",
            "dragon",
            "dreams",
            "driver",
            "eagle1",
            "eagles",
            "edward",
            "einstein",
            "erotic",
            "estrella",
            "extreme",
            "falcon",
            "fender",
            "ferrari",
            "firebird",
            "fishing",
            "florida",
            "flower",
            "flyers",
            "football",
            "forever",
            "freddy",
            "freedom",
            "fucked",
            "fucker",
            "fucking",
            "fuckme",
            "fuckyou",
            "gandalf",
            "gateway",
            "gators",
            "gemini",
            "george",
            "giants",
            "ginger",
            "gizmodo",
            "golden",
            "golfer",
            "gordon",
            "gregory",
            "guitar",
            "gunner",
            "hammer",
            "hannah",
            "hardcore",
            "harley",
            "heather",
            "helpme",
            "hentai",
            "hockey",
            "hooters",
            "horney",
            "hotdog",
            "hunter",
            "hunting",
            "iceman",
            "iloveyou",
            "internet",
            "iwantu",
            "jackie",
            "jackson",
            "jaguar",
            "jasmine",
            "jasper",
            "jennifer",
            "jeremy",
            "jessica",
            "johnny",
            "johnson",
            "jordan",
            "joseph",
            "joshua",
            "junior",
            "justin",
            "khan",
            "khanacademy",
            "killer",
            "knight",
            "ladies",
            "lakers",
            "lauren",
            "leather",
            "legend",
            "letmein",
            "little",
            "london",
            "lovers",
            "maddog",
            "madison",
            "maggie",
            "magnum",
            "marine",
            "mariposa",
            "marlboro",
            "martin",
            "marvin",
            "master",
            "math",
            "mathematics",
            "matrix",
            "matthew",
            "maverick",
            "maxwell",
            "melissa",
            "member",
            "mercedes",
            "merlin",
            "michael",
            "michelle",
            "mickey",
            "midnight",
            "miller",
            "mistress",
            "monica",
            "monkey",
            "monster",
            "morgan",
            "mother",
            "mountain",
            "muffin",
            "murphy",
            "mustang",
            "naked",
            "nascar",
            "nathan",
            "naughty",
            "ncc1701",
            "newyork",
            "nicholas",
            "nicole",
            "nipple",
            "nipples",
            "oliver",
            "orange",
            "packers",
            "panther",
            "panties",
            "parker",
            "password",
            "password1",
            "password12",
            "password123",
            "password1234",
            "patrick",
            "peaches",
            "peanut",
            "pepper",
            "phantom",
            "phoenix",
            "player",
            "please",
            "pookie",
            "porsche",
            "prince",
            "princess",
            "private",
            "purple",
            "pussies",
            "qazwsx",
            "qwerty",
            "qwertyui",
            "rabbit",
            "rachel",
            "racing",
            "raiders",
            "rainbow",
            "ranger",
            "rangers",
            "rebecca",
            "redskins",
            "redsox",
            "redwings",
            "richard",
            "robert",
            "roberto",
            "rocket",
            "rosebud",
            "runner",
            "rush2112",
            "russia",
            "sal",
            "salman",
            "salmankhan",
            "samantha",
            "sammy",
            "samson",
            "sandra",
            "saturn",
            "scooby",
            "scooter",
            "scorpio",
            "scorpion",
            "sebastian",
            "secret",
            "sexsex",
            "shadow",
            "shannon",
            "shaved",
            "sierra",
            "silver",
            "skippy",
            "slayer",
            "smokey",
            "snoopy",
            "soccer",
            "sophie",
            "spanky",
            "sparky",
            "spider",
            "squirt",
            "srinivas",
            "startrek",
            "starwars",
            "steelers",
            "steven",
            "sticky",
            "stupid",
            "success",
            "suckit",
            "summer",
            "sunshine",
            "superman",
            "surfer",
            "swimming",
            "sydney",
            "taylor",
            "tennis",
            "tequiero",
            "teresa",
            "tester",
            "testing",
            "theman",
            "thomas",
            "thunder",
            "thx1138",
            "tiffany",
            "tigers",
            "tigger",
            "tomcat",
            "topgun",
            "toyota",
            "travis",
            "trouble",
            "trustno1",
            "tucker",
            "turtle",
            "twitter",
            "united",
            "vagina",
            "victor",
            "victoria",
            "viking",
            "voodoo",
            "voyager",
            "walter",
            "warrior",
            "welcome",
            "whatever",
            "william",
            "willie",
            "wilson",
            "winner",
            "winston",
            "winter",
            "wizard",
            "xavier",
            "xxxxxx",
            "xxxxxxxx",
            "yamaha",
            "yankee",
            "yankees",
            "yellow",
            "zxcvbn",
            "zxcvbnm",
            "zzzzzz",
        ] if len(pw) >= MIN_PASSWORD_LENGTH])

    return _blacklisted_passwords
