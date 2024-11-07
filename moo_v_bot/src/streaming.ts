import axios from 'axios';
import { parse } from 'node-html-parser';

export class Streaming {
  private baseUrl = process.env.STREAMING_URL;
  private maxSearchNumber = 10;
  private headers = { headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } };

  constructor() {}

  // full search
  private async searchMoviesRequest(movieTitle: string, page = 1) {
    const searchCall = await axios(`${this.baseUrl}/search/?do=search&subaction=search&q=${movieTitle}&page=${page}`, this.headers).catch(err =>
      console.log(err)
    );
    return searchCall?.data;
  }

  async searchMovies(movieTitle: string, page?: number) {
    const searchResult = await this.searchMoviesRequest(movieTitle, page);
    const doc = parse(searchResult);
    const movies = doc.querySelectorAll('.b-content__inline_item');

    const moviesData = movies.map(movie => {
      const linkElement = movie?.querySelector('.b-content__inline_item-link');
      const [year, country, genre] = linkElement?.querySelector('div')?.innerText?.split(', ') ?? [];

      const movieDetails = {
        id: movie.attributes['data-id'],
        link: linkElement?.querySelector('a')?.attributes.href,
        title: linkElement?.querySelector('a')?.innerText,
        year,
        country,
        genre,
        // category: linkElement?.querySelector('div')?.innerText,
        type: movie?.querySelector('.cat .entity')?.innerHTML,
        info: movie?.querySelector('.info')?.innerHTML ?? 'ready'
      };
      return movieDetails;
    });

    return moviesData.slice(0, this.maxSearchNumber);
  }

  // quick content
  private async getMovieFullInfoByIdRequest(id: number) {
    const query = {
      id: id,
      is_touch: 1
    };
    const searchCall = await axios.post(`${this.baseUrl}/engine/ajax/quick_content.php`, query, this.headers).catch(err => console.log(err));
    return searchCall?.data;
  }

  async getMovieInfoById(id: number) {
    const searchResult = await this.getMovieFullInfoByIdRequest(id);
    const doc = parse(searchResult);
    const titleBlock = doc.querySelector('.b-content__bubble_title a');
    const link = titleBlock?.attributes.href;
    const title = titleBlock?.innerText;

    const ratingBlock = doc.querySelector('.b-content__bubble_rates');
    const rates = {
      imdb: {
        rate: ratingBlock?.querySelector('.imdb b')?.innerText,
        votes: ratingBlock?.querySelector('.imdb i')?.innerText
      },
      kp: {
        rate: ratingBlock?.querySelector('.kp b')?.innerText,
        votes: ratingBlock?.querySelector('.kp i')?.innerText
      }
    };

    const genre = doc.querySelectorAll('.b-content__bubble_text a').map(genre => genre.innerText);
    const director = doc.querySelectorAll('[itemprop="director"] [itemprop="name"]').map(genre => genre.innerText);
    const actors = doc.querySelectorAll('[itemprop="actor"] [itemprop="name"]').map(genre => genre.innerText);

    const movieInfo = { link, title, rates, genre, director, actors };
    return movieInfo;
  }

  private async getMovieInfoByUrlRequest(movieLink: string) {
    const searchCall = await axios(movieLink, this.headers).catch(err => console.log(err));
    return searchCall?.data;
  }

  async getMovieFullInfoByUrl(movieLink: string) {
    const searchResult = await this.getMovieInfoByUrlRequest(movieLink);
    const doc = parse(searchResult);
    const contentElement = doc.querySelector('.b-container.b-wrapper');
    if (!contentElement) throw new Error('Failed to fetch the element');

    const link = contentElement.querySelector('[itemprop="url"]')?.attributes.content;
    const name = contentElement.querySelector('[itemprop="name"]')?.innerText;
    const status = contentElement.querySelector('.b-post__go_status')?.innerText || contentElement.querySelector('.b-post__infolast')?.innerText;
    const originalName = contentElement.querySelector('[itemprop="alternativeHeadline"]')?.innerText;
    const poster = contentElement.querySelector('[itemprop="image"]')?.attributes.src;
    const rates = {
      imdb: {
        rate: contentElement.querySelector('.b-post__info_rates.imdb .bold')?.innerText,
        votes: contentElement.querySelector('.b-post__info_rates.imdb i')?.innerText
      },
      kp: {
        rate: contentElement.querySelector('.b-post__info_rates.kp .bold')?.innerText,
        votes: contentElement.querySelector('.b-post__info_rates.kp i')?.innerText
      }
    };

    const releaseDate = contentElement.querySelector('td:has(a[href*="year"])')?.innerText;
    const country = contentElement.querySelector('td:has(a[href*="country"])')?.innerText;

    const directors = contentElement
      .querySelectorAll('[itemprop="director"] [itemprop="name"]')
      .map(director => director.innerText)
      .join(', ');

    const genre = contentElement
      .querySelectorAll('[itemprop="genre"]')
      .map(genre => genre.innerText)
      .join(', ');

    const translations = contentElement
      .querySelectorAll('#translators-list li.b-translator__item')
      .map(translator => translator.innerText.trim())
      .join(', ');

    // const age: string;

    const chrono = contentElement.querySelector('[itemprop="duration"]')?.innerText;

    const cast = contentElement
      .querySelectorAll('[itemprop="actor"] [itemprop="name"]')
      .map(actor => actor.innerText)
      .join(', ');

    const description = contentElement.querySelector('.b-post__description_text')?.innerText.trim();

    const currentEpisode = contentElement.querySelector('.current-episode .td-1')?.innerText;

    const otherPartsHeader = contentElement.querySelector('.b-post__franchise_link_title')?.innerText;
    const otherParts = contentElement
      .querySelectorAll('.b-post__partcontent_item')
      .map(item => {
        const link = item.attributes?.['data-url'];
        const title = item.querySelector('.title')?.innerText;
        const year = item.querySelector('.year')?.innerText;
        const ratingData = item.querySelector('.rating')?.innerText;
        const rating = /\d/.test(ratingData as string) ? ratingData : '—';
        return { link, title, year, rating };
      })
      .filter(el => el.link);

    const fullMovieInfo = {
      link,
      name,
      originalName,
      status,
      releaseDate,
      country,
      poster,
      rates,
      directors,
      genre,
      translations,
      chrono,
      cast,
      description,
      currentEpisode,
      otherPartsHeader,
      otherParts
    };

    return fullMovieInfo;
  }
}
