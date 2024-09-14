import { BaseBot } from '../../common/bot_base';
import { InlineKeyboard, TelegramSendParam } from '../../common/types';
import { GroupSchema, UserSchema } from '../types';

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
    return input?.match(/^remove_\d$/);
  }

  isVoteMoviesCommand(input: string) {
    const startRegExp = new RegExp(`^/voteMovie(@${this.botName})?$`);
    return startRegExp.test(input);
  }

  isVoteWatchersCommand(input: string) {
    const startRegExp = new RegExp(`^/voteWatch(@${this.botName})?$`);
    return startRegExp.test(input);
  }

  async setWaitForMovieInput(chatId: number, inlineMessageId: number = 0) {
    await this.dynamoDbClient.updateItem<UserSchema>(this.getCompositeKey(chatId), { waitForMovieInput: inlineMessageId });
  }

  async setCurrentPoll(chatId: number, pollId: number) {
    // TODO: update type for updateItem to allow composite keys for updateProperty param
    const pollKey = 'votes.participants' as any;
    const pollValue: GroupSchema['votes']['participants'] = {
      active: true,
      poll_id: pollId,
      user_ids: []
    };
    await this.dynamoDbClient.updateItem<GroupSchema>(this.getCompositeKey(chatId), { [pollKey]: pollValue });
  }

  getCompositeKey(chatId: number, isDeleted = false) {
    return { chat_id: chatId, deleted: +isDeleted };
  }

  // TODO: update groupInputData type
  async addGroup(groupInputData: any) {
    const groupData: GroupSchema = {
      chat_id: groupInputData.id,
      deleted: 0,
      group_data: {
        group_name: groupInputData.username,
        group_title: groupInputData.title,
        timeUserAdded: new Date().getTime(),
        timeUserLastAction: new Date().getTime()
      },
      votes: {
        participants: {
          active: false,
          poll_id: 0,
          user_ids: []
        }
      }
    };
    return await this.dynamoDbClient.addItem<GroupSchema>(groupData);
  }

  // TODO: update userInputData type
  async addUser(userInputData: any) {
    const userData: UserSchema = {
      chat_id: userInputData.id,
      deleted: 0,
      movies: [],
      user_data: {
        first_name: userInputData.first_name,
        last_name: userInputData.last_name,
        timeUserAdded: new Date().getTime(),
        timeUserLastAction: new Date().getTime(),
        username: userInputData.username
      },
      waitForMovieInput: 0
    };
    return await this.dynamoDbClient.addItem<UserSchema>(userData);
  }

  async addMovie(chatId: number, movieName: string, options?: TelegramSendParam) {
    const baseMessage = 'Movie was successfully added to your list';
    const exceedsListLimit = `Currently you could store no more than <b>${this.maxMoviesCount} movies</b> in your list`;
    const compositeKey = this.getCompositeKey(chatId);

    const movies = await this.getMoviesList(chatId);
    const exceedsLengthLimit = movieName.trim().length > this.maxMovieTitleLength;
    const newMovie = exceedsLengthLimit ? movieName.trim().slice(0, this.maxMovieTitleLength).concat('...') : movieName.trim();
    movies?.push(newMovie);
    const exceedsLimit = movies?.length > this.maxMoviesCount;

    const message = exceedsLimit ? exceedsListLimit : baseMessage;

    if (!exceedsLimit) await this.dynamoDbClient.updateItem<UserSchema>(compositeKey, { movies: movies });

    await this.setWaitForMovieInput(chatId, 0);
    return await this.sendToTelegram(chatId, message, { updateMessageId: options?.updateMessageId });
  }

  async getItem<T extends UserSchema | GroupSchema>(chatId: number) {
    const compositeKey = this.getCompositeKey(chatId);
    return await this.dynamoDbClient.getItem<T>(compositeKey as Partial<T>);
  }

  async getMoviesList(chatId: number) {
    const userData = await this.getItem<UserSchema>(chatId);
    return userData?.movies;
  }

  async removeMovie(chatId: number, movieIndex: string, options?: TelegramSendParam) {
    const baseMessage = 'Movie was successfully removed from your list';
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
    await this.setWaitForMovieInput(chatId, options?.updateMessageId);
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

  async startVoteMovies(chatId: number) {
    const maxVoteOptionsCount = 10;
    const voteMessage = 'Which Movie would you like to watch today?';
    const listOfUsers = (await this.getItem<GroupSchema>(chatId))?.votes?.participants?.user_ids;
    if (listOfUsers?.length == 0) return this.sendToTelegram(chatId, 'Nobody wants to watch movies today =[');

    const usersQueryParams = listOfUsers.map(user => this.getCompositeKey(user));
    const allWatchersData = await this.dynamoDbClient.batchGetItem<UserSchema>(usersQueryParams);
    const allMovies = allWatchersData?.flatMap(user => user.movies);
    if (allMovies == undefined || allMovies?.length == 0) return this.sendToTelegram(chatId, 'It is up to you, which movie to watch!');

    const voteOptions: string[] = [];
    do {
      const randomIndex = Math.floor(allMovies.length * Math.random());
      voteOptions.push(...allMovies.splice(randomIndex, 1));
    } while (allMovies.length && voteOptions.length < maxVoteOptionsCount);

    return await this.sendToTelegramPoll(chatId, voteMessage, voteOptions, { is_anonymous: false, allows_multiple_answers: true });
  }

  async startVoteWatchers(chatId: number) {
    const voteMessage = 'Will you join us today to watch the Movie?';
    const voteOptions = ['Yes, I do!', 'Nope', 'Will consider'];
    const response = await this.sendToTelegramPoll(chatId, voteMessage, voteOptions, { is_anonymous: false });
    const pollId = +response.result.poll.id;
    await this.setCurrentPoll(chatId, pollId);
  }

  async getChatWithVote(pollId: number) {
    return this.dynamoDbClient.scanFotItem<GroupSchema>([{ ['votes.participants.poll_id' as any]: pollId }]);
  }

  async addWatcher(chatWithVote: GroupSchema, userId: number) {
    const compositeKey = this.getCompositeKey(chatWithVote.chat_id);
    const watchers = [userId].concat(chatWithVote?.votes?.participants?.user_ids ?? []);
    const newVotes = { participants: { user_ids: [...new Set(watchers)] } };
    const userIdsKey = 'votes.participants.user_ids' as any;
    await this.dynamoDbClient.updateItem<GroupSchema>(compositeKey, { [userIdsKey]: newVotes });
  }
}
