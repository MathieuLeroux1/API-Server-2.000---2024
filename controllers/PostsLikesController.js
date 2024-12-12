import Repository from '../models/repository.js';
import Controller from './Controller.js';
import PostsLikeModel from '../models/postsLike.js';

export default class PostsLikesController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new PostsLikeModel()));
    }
    removeLikesByUserId(userId) {
        let data = this.repository.getAll(this.HttpContext.path.params);
    
        const initialCount = data.length;
    
        data = data.filter(like => like.UserId !== userId);
    
        this.repository.objectsList = data;
    
        this.repository.write();
    
        return initialCount - data.length;
    }
}