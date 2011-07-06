import os
import Cookie
import logging
import unicodedata
import urllib2
import hashlib
from functools import wraps

from google.appengine.api import users
from google.appengine.api import memcache
from google.appengine.api import urlfetch

from app import App
import layer_cache
import request_cache
import util
from cookie_util import set_request_cookie

PHANTOM_ID_EMAIL_PREFIX = "http://nouserid.khanacademy.org/"
PHANTOM_MORSEL_KEY = 'ureg_id'

def is_phantom_email(email):
    return email.startswith(PHANTOM_ID_EMAIL_PREFIX)

def get_phantom_nickname_key(user):
    return "phantom_nickname_%s" % user.email()

def get_phantom_user_from_cookies():
    cookies = None
    try:
        cookies = Cookie.BaseCookie(os.environ.get('HTTP_COOKIE',''))
    except Cookie.CookieError, error:
        logging.critical("Ignoring Cookie Error: '%s'" % error)
        return None

    morsel = cookies.get(PHANTOM_MORSEL_KEY)
    if morsel and morsel.value:
        return users.User(PHANTOM_ID_EMAIL_PREFIX+morsel.value)
    else:
        return None

def create_phantom_user():
    rs = os.urandom(20)
    random_string = hashlib.md5(rs).hexdigest()
    return users.User(PHANTOM_ID_EMAIL_PREFIX+random_string)

def create_phantom(method):
    '''Decorator used to create phantom users if necessary.

    Warning:
    - Only use on get methods where a phantom user should be created.
    '''

    import models

    @wraps(method)
    def wrapper(self, *args, **kwargs):
        user_data = models.UserData.current()

        if not user_data:
            user = create_phantom_user()
            user_data = models.UserData.insert_for(user.email())
        
            # we set just a 20 digit random string as the cookie, 
            # not the entire fake email
            cookie = user_data.email.split(PHANTOM_ID_EMAIL_PREFIX)[1]
            # set the cookie on the user's computer
            self.set_cookie(PHANTOM_MORSEL_KEY, cookie)
            # make it appear like the cookie was already set
            set_request_cookie(PHANTOM_MORSEL_KEY, str(cookie))

        # Bust the cache so later calls to models.UserData.current() return 
        # the phantom user
        models.UserData.current(bust_cache=True)

        return method(self, *args, **kwargs)
    return wrapper

def disallow_phantoms(method, redirect_to='/login'):
    '''Decorator used to redirect phantom users.'''

    import models

    @wraps(method)
    def wrapper(self, *args, **kwargs):
        user_data = models.UserData.current()

        if user_data and user_data.is_phantom:
            self.redirect(redirect_to)
        else:
            return method(self, *args, **kwargs)
    return wrapper
