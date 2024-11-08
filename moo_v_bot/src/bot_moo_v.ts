import { BaseBot } from '../../common/bot_base';
import { InlineKeyboard, TelegramSendParam } from '../../common/types';
import { GroupSchema, UserSchema } from '../types';
import { Streaming } from './streaming';

export class MooVBot extends BaseBot {
  private maxMoviesCount: number;
  private maxMovieTitleLength: number;
  private streamingClient: Streaming;

  constructor(token: string) {
    super('moo_v_bot', token);
    this.maxMoviesCount = parseInt(process.env.MAX_MOVIE_COUNT as string) || 3;
    this.maxMovieTitleLength = 100;
    this.streamingClient = new Streaming();
  }

  isRemoveMovieCommand(input: string) {
    return input?.match(/^remove_\d$/);
  }

  async setWaitForMovieInput(chatId: number, waitForMovieInput: number = 0) {
    await this.dynamoDbClient.updateItem<UserSchema>(this.getCompositeKey(chatId), { waitForMovieInput: waitForMovieInput });
  }

  async setWaitForStreamingInput(chatId: number, waitForStreamingInput: number = 0) {
    await this.dynamoDbClient.updateItem<UserSchema>(this.getCompositeKey(chatId), { waitForStreamingInput: waitForStreamingInput });
  }

  async setCurrentPoll(chatId: number, pollId: string) {
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
          poll_id: '',
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
      streaming: {
        ready: [],
        wait: []
      },
      waitForMovieInput: 0,
      waitForStreamingInput: 0
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

  async inlineMenuGroup(chatId: number, options?: TelegramSendParam) {
    const message = 'What vote do you want to start?';

    const voteWatchers: InlineKeyboard[] = [{ text: 'Vote for Watchers', callback_data: 'vote_watchers' }];
    const voteMovies: InlineKeyboard[] = [{ text: 'Vote for Movie', callback_data: 'vote_movies' }];
    const cancel: InlineKeyboard[] = [{ text: 'Cancel', callback_data: 'inline_cancel' }];

    let inlineParams = [voteWatchers, voteMovies, cancel];
    console.log('Keyboard props: ', inlineParams);

    return await this.sendToTelegram(chatId, message, { updateMessageId: options?.updateMessageId, inlineKeyboard: inlineParams });
  }

  async inlineMenuPrivate(chatId: number, options?: TelegramSendParam) {
    const message = 'How can I help you?';

    const getList: InlineKeyboard[] = [{ text: 'List to watch with friends', callback_data: 'private_menu_list' }];
    const getStreaming: InlineKeyboard[] = [{ text: 'My personal list', callback_data: 'private_menu_streaming' }];
    const cancel: InlineKeyboard[] = [{ text: 'Cancel', callback_data: 'inline_cancel' }];

    let inlineParams = [getList, getStreaming, cancel];
    console.log('Keyboard props: ', inlineParams);

    return await this.sendToTelegram(chatId, message, { updateMessageId: options?.updateMessageId, inlineKeyboard: inlineParams });
  }

  async inlineAdd(chatId: number, options?: TelegramSendParam) {
    const baseMessage = 'Please type a movie title which you want to add in your list';
    const inlineParams: InlineKeyboard[] = [{ text: 'Cancel', callback_data: 'add_cancel' }];
    console.log('Keyboard props: ', inlineParams);

    await this.sendToTelegram(chatId, baseMessage, { updateMessageId: options?.updateMessageId, inlineKeyboard: [inlineParams] });
    await this.setWaitForMovieInput(chatId, options?.updateMessageId);
  }

  async inlineStreamingSearch(chatId: number, options?: TelegramSendParam) {
    const baseMessage = 'What movie/series are you looking for?';
    const inlineParams: InlineKeyboard[] = [{ text: 'Cancel', callback_data: 'private_menu_streaming' }];
    console.log('Keyboard props: ', inlineParams);

    await this.sendToTelegram(chatId, baseMessage, { updateMessageId: options?.updateMessageId, inlineKeyboard: [inlineParams] });
    await this.setWaitForStreamingInput(chatId, options?.updateMessageId);
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
    if (listOfUsers?.length == 0) return await this.sendToTelegram(chatId, 'Nobody wants to watch movies today =[');

    const usersQueryParams = listOfUsers.map(user => this.getCompositeKey(user));
    const allWatchersData = await this.dynamoDbClient.batchGetItem<UserSchema>(usersQueryParams);
    const allMovies = allWatchersData?.flatMap(user => user.movies);
    if (allMovies == undefined || allMovies?.length == 0) return await this.sendToTelegram(chatId, 'It is up to you, which movie to watch!');

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
    const pollId: string = response.result.poll.id;
    await this.setCurrentPoll(chatId, pollId);
  }

  async getChatWithVote(pollId: string) {
    return this.dynamoDbClient.scanFotItem<GroupSchema>([{ ['votes.participants.poll_id' as any]: pollId }]);
  }

  async addWatcher(chatWithVote: GroupSchema, userId: number) {
    const compositeKey = this.getCompositeKey(chatWithVote.chat_id);
    const watchers = [userId].concat(chatWithVote?.votes?.participants?.user_ids ?? []);
    const userIdsKey = 'votes.participants.user_ids' as any;
    await this.dynamoDbClient.updateItem<GroupSchema>(compositeKey, { [userIdsKey]: [...new Set(watchers)] });
  }

  async inlineMenuPrivateStreaming(chatId: number, options?: TelegramSendParam) {
    const message = 'How can I help you?';

    const searchForMovie: InlineKeyboard[] = [{ text: 'Search for a movie', callback_data: 'private_menu_streaming_search' }];
    const cancel: InlineKeyboard[] = [{ text: 'Cancel', callback_data: 'private_menu_streaming_cancel_search' }];

    let inlineParams = [searchForMovie, cancel];
    console.log('Keyboard props: ', inlineParams);

    return await this.sendToTelegram(chatId, message, { updateMessageId: options?.updateMessageId, inlineKeyboard: inlineParams });
  }

  async inlineStreamingSearchResult(chatId: number, movieTitle: string, page?: number) {
    const searchResult = await this.streamingClient.searchMovies(movieTitle, page);

    const inline: InlineKeyboard[][] = [];
    searchResult.forEach(foundMovie => {
      const button: InlineKeyboard[] = [
        { text: `${foundMovie.title} (${foundMovie.type}, ${foundMovie.country}, ${foundMovie.year})`, callback_data: foundMovie.id }
      ];
      return inline.push(button);
    });
    inline.push([{ text: 'Cancel', callback_data: 'private_menu_streaming' }]);

    const message = searchResult.length ? "That's what I have found:" : "Unfortunately I couldn't find anything with your query";

    await this.setWaitForStreamingInput(chatId, 0);
    return await this.sendToTelegram(chatId, message, { inlineKeyboard: inline });
  }

  async inlineStreamingMovieData(chatId: number, movieId: number, options?: TelegramSendParam) {
    const megaTab = (tabLength = 8) => '\t'.repeat(tabLength);
    const movieLinkData = await this.streamingClient.getMovieInfoById(movieId);
    if (!movieLinkData.link) {
      const inline = [{ text: 'Cancel', callback_data: 'private_menu_streaming' }];
      return await this.sendToTelegram(chatId, 'Sorry, no data for the movie', {
        updateMessageId: options?.updateMessageId,
        inlineKeyboard: [inline]
      });
    }

    const movieData = await this.streamingClient.getMovieFullInfoByUrl(movieLinkData.link);

    function appendLine(title: string | undefined, data: string | undefined, option = { spoiler: false }) {
      const extraStartTag = option.spoiler ? '<tg-spoiler>' : '';
      const extraFinishTag = option.spoiler ? '</tg-spoiler>' : '';
      const titleText = `<b>${megaTab() + title}:</b>\t\t`;
      const contentText = extraStartTag + data + extraFinishTag;
      return data && title ? titleText + contentText : '';
    }
    const title = `<b><a href="${movieData.link}">${movieData.name}</a></b>`;
    const statusInfo = movieData.status ? `\t\t<i>(${movieData.status.trim().toLowerCase()})</i>` : '';
    function getRate(rateSource: 'IMDb' | 'Кинопоиск', sourceData: typeof movieData.rates.imdb) {
      const sourceText = `<u>${rateSource}</u>: `;
      const dataText = sourceData.rate ? `<b>${sourceData.rate}</b> <i>${sourceData.votes || 0}</i>` : '—';
      return sourceText + dataText;
    }
    const imdbRates = getRate('IMDb', movieData.rates.imdb);
    const kpRates = getRate('Кинопоиск', movieData.rates.kp);
    const ratesData = imdbRates + megaTab(2) + kpRates;
    const otherPartsData = movieData.otherParts
      .map(el => `\n${megaTab(10)}•\t<a href="${el.link}">${el.title}</a> – ${el.year} (${el.rating})`)
      .join('');
    const message = [
      'Доступная информация о картине:\n',
      appendLine('Название', title + statusInfo),
      appendLine('Оригинальное название', movieData.originalName),
      appendLine('Доступный эпизод', movieData.currentEpisode),
      appendLine('Рейтинги', ratesData),
      appendLine('Дата выхода', movieData.releaseDate),
      appendLine('Страна', movieData.country),
      appendLine('Режиссер', movieData.directors),
      appendLine('Жанр', movieData.genre),
      appendLine('Время', movieData.chrono),
      appendLine('В ролях актеры', movieData.cast),
      appendLine('Описание', movieData.description, { spoiler: true }),
      appendLine('В переводе', movieData.translations),
      appendLine(movieData.otherPartsHeader, otherPartsData)
    ];
    // poster - no need
    const inline = [{ text: 'Cancel', callback_data: 'private_menu_streaming' }];
    return await this.sendToTelegram(chatId, message.filter(el => el).join('\n'), {
      updateMessageId: options?.updateMessageId,
      inlineKeyboard: [inline]
    });
  }
}
