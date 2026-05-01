import goodbye1 from '../../ASL pics/Greetings/Goodbye1-removebg-preview.png';
import goodbye2 from '../../ASL pics/Greetings/Goodbye2-removebg-preview.png';
import happyBirthday1 from '../../ASL pics/Greetings/Happy Birthday 1.png';
import happyBirthday2 from '../../ASL pics/Greetings/Happy Birthday 2.png';
import happyBirthday3 from '../../ASL pics/Greetings/Happy Birthday 3.png';
import hello from '../../ASL pics/Greetings/Hello-removebg-preview.png';
import mama from '../../ASL pics/Greetings/Mama-removebg-preview.png';
import thankYou1 from '../../ASL pics/Greetings/TY_1-removebg-preview.png';
import thankYou2 from '../../ASL pics/Greetings/TY_2-removebg-preview.png';
import help from '../../ASL pics/Daily Conversations/Help.png';
import no1 from '../../ASL pics/Daily Conversations/No_1.png';
import no2 from '../../ASL pics/Daily Conversations/No_2.png';
import yes from '../../ASL pics/Daily Conversations/Yes.png';

export const SIGN_IMAGE_MAP = {
  greeting_hello: hello,
  greeting_goodbye_1: goodbye1,
  greeting_goodbye_2: goodbye2,
  greeting_happy_birthday_1: happyBirthday1,
  greeting_happy_birthday_2: happyBirthday2,
  greeting_happy_birthday_3: happyBirthday3,
  greeting_mama: mama,
  greeting_thank_you_1: thankYou1,
  greeting_thank_you_2: thankYou2,
  daily_yes: yes,
  daily_no_1: no1,
  daily_no_2: no2,
  daily_help: help,
};

export const resolveSignImageUrl = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  if (!imageUrl.startsWith('asset:')) return imageUrl;
  const key = imageUrl.slice('asset:'.length);
  return SIGN_IMAGE_MAP[key] || null;
};
