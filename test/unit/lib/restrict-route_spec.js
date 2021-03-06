'use strict';

const express = require('express'),
    restrict = require('../../../lib/restrict-route'),
    cookieParser = require('cookie-parser'),
    supertest = require('supertest');

describe('restrict', () => {

    let authUserMock,
        authUrl,
        route,
        app,
        authToken,
        refreshToken,
        request,
        successMiddleware,
        userData;

    beforeEach(() => {
        authUrl = 'https://some.auth.endpoint/auth/me';
        authToken = 'asca3obt20tb302tbwktblwekblqtbeltq';
        refreshToken = 'abowaefbawofbwaoefubaweofwwagwb';
        route = {
            accessLevel: 'admin'
        };
        userData = {
            username: 'smithm',
            email: 'email@example.com'
        };
        authUserMock = jasmine.createSpy('authUser');

        successMiddleware = (req, res) => {
            res.sendStatus(200);
        };

        app = express();
        app.use(cookieParser());
        request = supertest(app);
    });

    it('throws with invalid arguments', () => {
        expect(() => {
            restrict({route: null, getUser: null});
        }).toThrow();

        expect(() => {
            restrict({route: null, getUser: authUserMock});
        }).toThrow();
    });

    describe('when the route is authenticated', () => {

        beforeEach(() => {
            authUserMock.and.callFake(({authToken, refreshToken}, cb) => {
                cb(null, userData);
            });
        });

        it('stores the user data on the request and session if authentication succeeds', done => {
            function addMockSession(req, res, next) {
                req.session = {};
                next();
            }

            function checkRequest(req, res) {
                expect(req.user).toEqual(userData);
                expect(req.session.user).toEqual(userData);

                res.sendStatus(200);
            }

            app.get('/test', addMockSession, restrict({route, getUser: authUserMock}), checkRequest);

            request
                .get('/test')
                .set('auth-token', authToken)
                .set('refresh-token', refreshToken)
                .then(() => {
                    expect(authUserMock).toHaveBeenCalledWith({authToken, refreshToken}, jasmine.any(Function));
                    done();
                }).catch(done.fail);
        });

        it('uses an auth token cookie if it exists', done => {
            app.get('/test', restrict({route, getUser: authUserMock}), successMiddleware);

            request
                .get('/test')
                .set('Cookie', `authToken=${authToken}`)
                .then(() => {
                    expect(authUserMock).toHaveBeenCalledWith({authToken, refreshToken: ''}, jasmine.any(Function));
                    done();
                }).catch(done.fail);
        });

        it('responds with an error status if user authentication fails', done => {
            authUserMock.and.callFake(({}, cb) => {
                cb(new Error('auth error'));
            });

            app.get('/test', restrict({route, getUser: authUserMock}), successMiddleware);

            request
                .get('/test')
                .set('auth-token', authToken)
                .expect(401, done);
        });

        it('fails if there was an invalid response', done => {
            let authError = new Error('invalid response');
            authError.type = 'InvalidProfileError';

            authUserMock.and.callFake(({}, cb) => {
                cb(authError);
            });

            app.get('/test', restrict({route, getUser: authUserMock}), successMiddleware);

            request
                .get('/test')
                .set('auth-token', authToken)
                .expect(401)
                .then(data => {
                    expect(data.body.error).toBe('invalid response');
                    done();
                })
                .catch(done.fail);
        });

    });

    describe('when the route is not authenticated', () => {

        it('does not authenticate if the headers do not contain an auth token', done => {
            route.accessLevel = 'admin';

            app.get('/test', restrict({route, getUser: authUserMock}), successMiddleware);

            request
                .get('/test')
                .expect(200)
                .then(() => {
                    expect(authUserMock).not.toHaveBeenCalled();
                    done();
                })
                .catch(done.fail);
        });

        it('does not authenticate if the route does not have an accessLevel check', done => {
            route.accessLevel = undefined;

            app.get('/test', restrict({route, getUser: authUserMock}), successMiddleware);

            request
                .get('/test')
                .set('auth-token', authToken)
                .expect(200)
                .then(() => {
                    expect(authUserMock).not.toHaveBeenCalled();
                    done();
                })
                .catch(done.fail);
        });

        it('does not authenticate if the route has a public accessLevel', done => {
            route.accessLevel = 'public';

            app.get('/test', restrict({route, getUser: authUserMock}), successMiddleware);

            request
                .get('/test')
                .set('auth-token', authToken)
                .expect(200)
                .then(() => {
                    expect(authUserMock).not.toHaveBeenCalled();
                    done();
                })
                .catch(done.fail);
        });

        it('does not authenticate if the user is already authenticated', done => {
            function auth(req, res, next) {
                req.user = {};
                next();
            }

            route.accessLevel = 'admin';

            app.get('/test', auth, restrict({route, getUser: authUserMock}), successMiddleware);

            request
                .get('/test')
                .set('auth-token', authToken)
                .expect(200)
                .then(() => {
                    expect(authUserMock).not.toHaveBeenCalled();
                    done();
                })
                .catch(done.fail);
        });

    });

});
