import { BaseBot } from '../../common/bot_base';
import { InlineKeyboard, TelegramSendParam } from '../../common/types';
import { UserSchema } from '../types';

export class MooVBot extends BaseBot {
  private maxMoviesCount: number;
  private maxMovieTitleLength: number;

  constructor(token: string) {
    super('moo_v_bot', token);
    this.maxMoviesCount = 3;
    this.maxMovieTitleLength = 100;
  }

  isGetListCommand(input: string) {
    const startRegExp = new RegExp(`^/getList(@${this.botName})?$`);
    return startRegExp.test(input);
  }

  isRemoveMovieCommand(input: string) {
    return input.match(/^remove_\d$/);
  }

  getCompositeKey(chatId: number, isDeleted = false) {
    return { chat_id: chatId, deleted: +isDeleted };
  }

  async addMovie(chatId: number, movieName: string, options?: TelegramSendParam) {
    const baseMessage = 'Movies was successfully added to your list';
    const exceedsListLimit = `Currently you could store no more than <b>${this.maxMoviesCount} movies</b> in your list`;
    const compositeKey = this.getCompositeKey(chatId);

    const movies = await this.getMoviesList(chatId);
    const newMovie = movieName.trim().slice(0, this.maxMovieTitleLength).concat('...');
    movies?.push(newMovie);
    const exceedsLimit = movies?.length > this.maxMoviesCount;

    const message = exceedsLimit ? exceedsListLimit : baseMessage;

    if (!exceedsLimit) await this.dynamoDbClient.updateItem<UserSchema>(compositeKey, { movies: movies });

    await this.dynamoDbClient.updateItem<UserSchema>(compositeKey, { waitForMovieInput: false });
    return await this.sendToTelegram(chatId, message, { updateMessageId: options?.updateMessageId });
  }

  async getMoviesList(chatId: number) {
    const compositeKey = this.getCompositeKey(chatId);
    const userData = await this.dynamoDbClient.getItem<UserSchema>(compositeKey);
    return userData?.movies;
  }

  async removeMovie(chatId: number, movieIndex: string, options?: TelegramSendParam) {
    const baseMessage = 'Movies was successfully removed from your list';
    const swwMessage = `Something went wrong. Please try again later`;
    const compositeKey = this.getCompositeKey(chatId);

    try {
      await this.dynamoDbClient.removeItem<UserSchema>(compositeKey, `movies[${movieIndex}]`);
      await this.sendToTelegram(chatId, baseMessage, { updateMessageId: options?.updateMessageId });
    } catch (err) {
      await this.sendToTelegram(chatId, swwMessage, { updateMessageId: options?.updateMessageId });
    }
  }

  async inlineAdd(chatId: number, options?: TelegramSendParam) {
    const baseMessage = 'Please type a movie title which you want to add in your list';
    const inlineParams: InlineKeyboard[] = [{ text: 'Cancel', callback_data: 'add_cancel' }];
    console.log('Keyboard props: ', inlineParams);

    await this.sendToTelegram(chatId, baseMessage, { updateMessageId: options?.updateMessageId, inlineKeyboard: [inlineParams] });

    const compositeKey = this.getCompositeKey(chatId);
    await this.dynamoDbClient.updateItem<UserSchema>(compositeKey, { waitForMovieInput: true });
  }

  async inlineList(chatId: number, options?: TelegramSendParam) {
    let baseMessage = 'You have saved next movies to your list:';
    const noItemsMessage = 'You have no items in the list';

    const movies = await this.getMoviesList(chatId);
    const hasMovies = movies?.length;

    const inlineAdd: InlineKeyboard[] = [{ text: 'Add Movie', callback_data: 'list_add' }];
    const inlineRemove: InlineKeyboard[] = [{ text: 'Remove Movie', callback_data: 'list_remove' }];

    if (movies) movies.forEach(movie => (baseMessage += `\n\t• ${movie}`));
    const message = hasMovies ? baseMessage : noItemsMessage;

    let inlineParams = [];
    if (movies?.length < this.maxMoviesCount) inlineParams.push(inlineAdd);
    if (hasMovies) inlineParams.push(inlineRemove);
    console.log('Keyboard props: ', inlineParams);

    await this.sendToTelegram(chatId, message, { updateMessageId: options?.updateMessageId, inlineKeyboard: inlineParams });
  }

  async inlineRemove(chatId: number, options?: TelegramSendParam) {
    const baseMessage = 'Which movie do you want to remove from your list?';
    const movies = await this.getMoviesList(chatId);

    const constructRemoveOption = (title: string, i: number) => {
      return [{ text: title, callback_data: `remove_${i}` }];
    };

    const inlineCancel: InlineKeyboard[] = [{ text: 'Cancel', callback_data: 'remove_cancel' }];

    let inlineParams = movies?.map(constructRemoveOption);
    inlineParams.push(inlineCancel);
    console.log('Keyboard props: ', inlineParams);

    await this.sendToTelegram(chatId, baseMessage, { updateMessageId: options?.updateMessageId, inlineKeyboard: inlineParams });
  }
}
