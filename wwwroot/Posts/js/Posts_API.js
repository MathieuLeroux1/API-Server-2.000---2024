
class Posts_API {
    static Host_URL() { return "http://localhost:5000"; }
    static POSTS_API_URL() { return this.Host_URL() + "/api/posts" };
    static USERS_API_URL() { return this.Host_URL() + "/api/users" };
    static LIKES_API_URL() { return this.Host_URL() + "/api/postslikes" };


    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
    }
    static setHttpErrorState(xhr) {
        if (xhr.responseJSON)
            this.currentHttpError = xhr.responseJSON.error_description;
        else
            this.currentHttpError = xhr.statusText == 'error' ? "Service introuvable" : xhr.statusText;
        this.currentStatus = xhr.status;
        this.error = true;
    }
    static async HEAD() {
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTS_API_URL(),
                type: 'HEAD',
                contentType: 'text/plain',
                complete: data => { resolve(data.getResponseHeader('ETag')); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Get(id = null) {
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTS_API_URL() + (id != null ? "/" + id : ""),
                complete: data => { resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON }); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async GetQuery(queryString = "") {
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTS_API_URL() + queryString,
                complete: data => {
                    resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON });
                },
                error: (xhr) => {
                    Posts_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
    static async Save(data, create = true) {
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: create ? this.POSTS_API_URL() : this.POSTS_API_URL() + "/" + data.Id,
                type: create ? "POST" : "PUT",
                contentType: 'application/json',
                data: JSON.stringify(data),
                success: (data) => { resolve(data); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Delete(id) {
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTS_API_URL() + "/" + id,
                type: "DELETE",
                success: () => {
                    Posts_API.initHttpState();
                    resolve(true);
                },
                error: (xhr) => {
                    Posts_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
    static login(Email, Password) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.tokenRequestURL(),
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ Email, Password }),
                success: (response) => {
                    this.storeAccessToken(response.Access_token);
                    this.storeLoggedUser(response.User);  
                    resolve(response);
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }
    
    static logout(userId){
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/logout?userId=" + userId,
                type: 'GET',
                contentType: 'application/json',
                success: (response) => {
                    this.ereaseAccessToken();
                    this.ereaseLoggedUser();
                    resolve(response);
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        })
    }
    static register(profil){
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/register",
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(profil),
                success: profil => {resolve(profil);},
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }
    static verify(id, code){
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.verifiyRequestURL() + `?id=${id}&code=${code}`,
                type: 'GET',
                contentType: 'application/json',
                success: code => {
                    resolve(code);
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }
    static modifiy(profil){
        this.initHttpState();
        const accessToken = this.retriveAccessToken();

        return new Promise(resolve => {
            $.ajax({
                url: this.modifiyRequestURL(),
                type: 'PUT',
                contentType: 'application/json',
                headers: {
                    Authorization: this.getBearerToken(accessToken)
                },
                data: JSON.stringify(profil),
                success: user => {
                    this.ereaseLoggedUser();
                    this.storeLoggedUser(user);
                    resolve(user);
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }
    static Promote(user) {
        this.initHttpState();
        const accessToken = this.retriveAccessToken();
        this.user = user;
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/promote",
                type: 'POST',
                contentType: 'application/json',
                headers: {
                    Authorization: this.getBearerToken(accessToken)
                },
                data: JSON.stringify(user),
                success: (response) => {
                    resolve(response);
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }
    static Block(user) {
        this.initHttpState();
        const accessToken = this.retriveAccessToken();
        this.user = user;
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/block",
                type: 'POST',
                contentType: 'application/json',
                headers: {
                    Authorization: this.getBearerToken(accessToken)
                },
                data: JSON.stringify(user),
                success: (response) => {
                    resolve(response);
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }
    static Remove(userId) {
        this.initHttpState();
        const accessToken = this.retriveAccessToken();
        return new Promise(resolve => {
            $.ajax({
                url: this.Host_URL() + "/accounts/remove/" + userId,
                type: 'GET',
                contentType: 'application/json',
                headers: {
                    Authorization: this.getBearerToken(accessToken)
                },
                success: (response) => {
                    resolve(response);
                },
                error: (xhr) => {
                    this.setHttpErrorState(xhr);
                    resolve(null);
                }
            });
        });
    }
    static storeAccessToken(token){
        sessionStorage.setItem('access_Token',token);
    }
    static ereaseAccessToken(){
        sessionStorage.removeItem('access_Token');
    }
    static retriveAccessToken(){
        return sessionStorage.getItem('access_Token');
    }
    static storeLoggedUser(user){
        sessionStorage.setItem('user', JSON.stringify(user));
    }
    static ereaseLoggedUser(){
        sessionStorage.removeItem('user');
    }
    static retriveLoggedUser(){
        let user = JSON.parse(sessionStorage.getItem('user'));
        return user;
    }
    static getBearerToken(accessToken){
        return `Bearer ${accessToken}`;
    }
    static tokenRequestURL() {
        return this.Host_URL() + "/token";
    }
    static checkConflictURL() {
        return this.Host_URL() + "/accounts/conflict";
    }
    static verifiyRequestURL(){
        return this.Host_URL() + "/accounts/verify";
    }
    static modifiyRequestURL(){
        return this.Host_URL() + "/accounts/modify";
    }

    static async GetUserByEmail(email){
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.USERS_API_URL() + "?Email=" + email,
                complete: data => { resolve(data); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async GetUser(id = null) {
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.USERS_API_URL() + (id != null ? "/" + id : ""),
                complete: data => { resolve(data); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async GetLikes(postId = null, userId = null) {
        Posts_API.initHttpState();
        let url = this.LIKES_API_URL();

        if (postId != null) {
            url += "?PostId=" + postId;
        }

        if (userId != null) {
            url += (url.includes('?') ? '&' : '?') + "UserId=" + userId;
        }

        return new Promise(resolve => {
            $.ajax({
                url: url,
                complete: data => { resolve(data); },
                error: (xhr) => {
                    if (xhr.status === 404) {
                        Posts_API.setHttpErrorState(xhr);
                        resolve({ data: [] });
                    } else {
                        Posts_API.setHttpErrorState(xhr);
                        resolve(null);
                    }
                }
            });
        });
    }
    static likePost(like){
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.LIKES_API_URL(),
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(like),
                complete: data => { resolve(data); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static removeLikePost(id) {
        Posts_API.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.LIKES_API_URL() + "/" + id,
                type: 'DELETE',
                contentType: 'application/json',
                complete: data => { resolve(data); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
}