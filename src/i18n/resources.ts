// Complete dictionaries for translation validation. Runtime loads only the selected language.
import ar from './ar.json';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import it from './it.json';
import ru from './ru.json';
import uk from './uk.json';

export const RESOURCES = { en, ru, uk, de, fr, es, it, ar } as const;
