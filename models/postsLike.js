import Model from './model.js';

export default class PostsLike extends Model {
    constructor() {
        super();

        this.addField('PostId', 'string');
        this.addField('UserId', 'string');
    }
}